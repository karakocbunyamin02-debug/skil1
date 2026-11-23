# status-line

A Claude Code mod that keeps you informed while you work. It pins a short
status line under the prompt (model, how full the context window is, the
session's cost so far, and how much of the 5-hour and weekly rate limits
you've used), and it opens a fuller usage panel — with session stats, tool
call counts, rate-limit bars with time remaining, context usage, and cost —
whenever you run `/panel`. The panel also opens automatically when a session
starts. Everything is read from Claude Code's own session and usage APIs;
the mod stores no data outside this session's state and makes no network
calls of its own.

## Install

```
/plugin install status-line --marketplace karakocbunyamin02/claude-status-line
```
