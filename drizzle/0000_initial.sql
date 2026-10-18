CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, salt TEXT NOT NULL, profile TEXT, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE likes (sender TEXT NOT NULL, recipient TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(sender,recipient,day));
--> statement-breakpoint
CREATE TRIGGER daily_like_limit BEFORE INSERT ON likes WHEN (SELECT COUNT(*) FROM likes WHERE sender=NEW.sender AND day=NEW.day)>=3 BEGIN SELECT RAISE(ABORT,'DAILY_LIMIT'); END;
--> statement-breakpoint
CREATE TABLE messages (id TEXT PRIMARY KEY, sender TEXT NOT NULL, recipient TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE blocks (sender TEXT NOT NULL, recipient TEXT NOT NULL, PRIMARY KEY(sender,recipient));
--> statement-breakpoint
CREATE TABLE reports (id TEXT PRIMARY KEY, sender TEXT NOT NULL, recipient TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE recommendations (owner TEXT NOT NULL, day TEXT NOT NULL, recipient TEXT NOT NULL, PRIMARY KEY(owner,day,recipient));
--> statement-breakpoint
CREATE TABLE attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX messages_conversation ON messages(sender,recipient,created);
