---
name: autofix
description: Auto-fix CodeRabbit review comments - get CodeRabbit review comments from GitHub and fix them interactively or in batch
---

# CodeRabbit Autofix

Fetch CodeRabbit review comments for your current branch's PR and fix them interactively or in batch.

## Prerequisites

### Required Tools
- `gh` (GitHub CLI) - must be installed and authenticated
- `git`

Verify: `gh auth status`

### Required State
- Git repo on GitHub
- Current branch has open PR
- PR reviewed by CodeRabbit bot (`coderabbitai`, `coderabbit[bot]`, `coderabbitai[bot]`)

## Quick Start

1. Check if you have an open PR: `gh pr list --head $(git branch --show-current) --state open`
2. If you have CodeRabbit review comments, this skill will fetch them and help you fix them
3. You can choose between manual review (recommended) or auto-fix mode

## Workflow

### Step 1: Check Current State

Check: `git status` + check for unpushed commits

**If uncommitted changes:**
- Warn: "⚠️ Uncommitted changes won't be in CodeRabbit review"
- Ask: "Commit and push first?" → If yes: wait for user action, then continue

**If unpushed commits:**
- Warn: "⚠️ N unpushed commits. CodeRabbit hasn't reviewed them"
- Ask: "Push now?" → If yes: `git push`, inform "CodeRabbit will review in ~5 min", EXIT skill

### Step 2: Find Open PR

```bash
gh pr list --head $(git branch --show-current) --state open --json number,title
```

**If no PR:** Ask "Create PR?" → If yes: create PR, inform "Run skill again in ~5 min", EXIT

### Step 3: Fetch CodeRabbit Issues

Fetch PR review threads and filter to:
- unresolved threads only
- threads started by CodeRabbit bot

**If no unresolved CodeRabbit threads:** Inform "No unresolved CodeRabbit review threads found", EXIT

### Step 4: Display Issues and Choose Fix Mode

Display found issues and ask user to choose:
- 🔍 "Review each issue" - Manual review and approval (recommended)
- ⚡ "Auto-fix all" - Apply all fixes without approval
- ❌ "Cancel" - Exit

### Step 5: Apply Fixes

**Manual Review Mode:**
For each issue: show context, proposed fix, and ask for approval

**Auto-Fix Mode:**
Apply all fixes automatically and track changes

### Step 6: Commit and Push

Create consolidated commit for all applied fixes and optionally push to remote.

---

**Note:** This skill requires GitHub CLI authentication and works best with repositories that have active CodeRabbit review integration.