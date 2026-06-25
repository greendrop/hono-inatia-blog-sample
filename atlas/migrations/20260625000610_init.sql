-- Create "posts" table
CREATE TABLE `posts` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (current_timestamp),
  `updated_at` text NOT NULL DEFAULT (current_timestamp)
);
