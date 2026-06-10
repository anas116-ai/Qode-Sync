-- Fork Tracker V1 - Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
CREATE TYPE token_status AS ENUM ('valid', 'invalid', 'expired', 'revoked');
CREATE TYPE sync_status AS ENUM ('synced', 'behind', 'ahead', 'diverged', 'unknown');
CREATE TYPE update_type AS ENUM ('commit', 'release', 'tag', 'security_advisory', 'breaking_change');
CREATE TYPE update_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE update_status AS ENUM ('new', 'viewed', 'synced', 'ignored');
CREATE TYPE sync_job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE notification_frequency AS ENUM ('instant', 'daily', 'weekly');

-- User Profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    email TEXT,
    github_pat_encrypted TEXT,
    github_pat_status token_status DEFAULT 'valid',
    github_pat_last_validated TIMESTAMPTZ,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    max_repositories INT DEFAULT 500,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    notification_frequency notification_frequency DEFAULT 'instant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

-- Repositories
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    github_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    owner TEXT NOT NULL,
    description TEXT,
    language TEXT,
    is_fork BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    default_branch TEXT DEFAULT 'main',
    stars_count INT DEFAULT 0,
    forks_count INT DEFAULT 0,
    open_issues_count INT DEFAULT 0,
    parent_github_id BIGINT,
    parent_full_name TEXT,
    parent_owner TEXT,
    parent_default_branch TEXT DEFAULT 'main',
    sync_status sync_status DEFAULT 'unknown',
    ahead_count INT DEFAULT 0,
    behind_count INT DEFAULT 0,
    divergence_count INT DEFAULT 0,
    is_watched BOOLEAN DEFAULT TRUE,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    category TEXT,
    custom_labels JSONB DEFAULT '[]',
    health_score FLOAT DEFAULT 100.0,
    risk_score FLOAT DEFAULT 0.0,
    last_commit_at TIMESTAMPTZ,
    last_release_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, github_id)
);

-- Updates
CREATE TABLE updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    update_type update_type NOT NULL,
    status update_status DEFAULT 'new',
    severity update_severity DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    ai_summary TEXT,
    ai_summary_detailed TEXT,
    github_sha TEXT,
    github_url TEXT,
    author TEXT,
    files_changed INT DEFAULT 0,
    additions INT DEFAULT 0,
    deletions INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    UNIQUE(repository_id, github_sha)
);

-- Update Commits
CREATE TABLE update_commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    message TEXT NOT NULL,
    author TEXT,
    author_date TIMESTAMPTZ,
    url TEXT,
    additions INT DEFAULT 0,
    deletions INT DEFAULT 0
);

-- Update Releases
CREATE TABLE update_releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    name TEXT,
    body TEXT,
    prerelease BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    github_url TEXT
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    update_id UUID REFERENCES updates(id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    channel TEXT DEFAULT 'email',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Sync Jobs
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status sync_job_status DEFAULT 'pending',
    total_repos INT DEFAULT 0,
    processed_repos INT DEFAULT 0,
    successful_repos INT DEFAULT 0,
    failed_repos INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_repos_user ON repositories(user_id);
CREATE INDEX idx_repos_fork ON repositories(user_id, is_fork);
CREATE INDEX idx_repos_sync ON repositories(sync_status);
CREATE INDEX idx_updates_repo ON updates(repository_id);
CREATE INDEX idx_updates_user ON updates(user_id);
CREATE INDEX idx_updates_status ON updates(user_id, status);
CREATE INDEX idx_updates_created ON updates(created_at);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(user_id, is_read);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own repos" ON repositories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own updates" ON updates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own commits" ON update_commits FOR ALL USING (
    EXISTS (SELECT 1 FROM updates WHERE updates.id = update_commits.update_id AND updates.user_id = auth.uid())
);
CREATE POLICY "Users manage own releases" ON update_releases FOR ALL USING (
    EXISTS (SELECT 1 FROM updates WHERE updates.id = update_releases.update_id AND updates.user_id = auth.uid())
);
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sync jobs" ON sync_jobs FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_repositories_updated BEFORE UPDATE ON repositories FOR EACH ROW EXECUTE FUNCTION update_updated_at();