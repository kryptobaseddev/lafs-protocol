# GitBook Setup Guide

This guide explains how to sync the LAFS documentation with GitBook for hosted documentation.

## Prerequisites

1. GitBook account (https://gitbook.com)
2. Access to the LAFS GitHub repository
3. Admin permissions on the GitHub repository

## Setup Steps

### 1. Install GitBook GitHub App

1. Go to your GitBook organization dashboard
2. Click **Integrations** in the sidebar
3. Find **GitHub** and click **Install**
4. Select the `lafs-protocol` repository
5. Grant necessary permissions

### 2. Create GitBook Space

1. In GitBook, click **Create a space**
2. Name it "LAFS Protocol Documentation"
3. Select **Sync with GitHub**
4. Choose the repository: `kryptobaseddev/lafs-protocol`
5. Select branch: `main`
6. Set root directory: `docs/`
7. Click **Create**

### 3. Configure Git Sync

The repository already has `.gitbook.yaml` configured:

```yaml
root: ./docs/
structure:
  readme: README.md
  summary: SUMMARY.md

destinations:
  - name: gitbook
    branch: main

defaults:
  colors:
    primary: "#4A90D9"
    background: "#FAFAFA"
  darkMode: true

title: LAFS Protocol Documentation
description: LLM-Agent-First Specification - Response envelope contracts for AI agent systems
```

GitBook will automatically detect this configuration.

### 4. Verify Sync

1. Wait for initial sync (may take 2-3 minutes)
2. Check the space in GitBook
3. Verify all pages appear:
   - Getting Started (4 pages)
   - Specification
   - Integration Guides (4 pages)
   - SDK Reference (3 pages)
   - Conformance
   - Reference (5 pages)

### 5. Configure Custom Domain (Optional)

To use docs.lafs.dev:

1. In GitBook space settings, go to **Domains**
2. Click **Add custom domain**
3. Enter: `docs.lafs.dev`
4. GitBook will provide DNS records
5. Add CNAME record in your DNS:
   ```
   docs.lafs.dev → hosting.gitbook.io
   ```
6. Wait for SSL certificate (automatic)

### 6. Enable LLM Features

GitBook automatically generates:

1. **llms.txt** endpoint:
   ```
   https://docs.lafs.dev/llms.txt
   ```

2. **Markdown endpoints**:
   ```
   https://docs.lafs.dev/getting-started/quickstart.md
   ```

3. **MCP Server**:
   ```
   https://docs.lafs.dev/~gitbook/mcp
   ```

### 7. Test Documentation

Verify the following work:

```bash
# Check discovery document
curl https://docs.lafs.dev/.well-known/lafs.json

# Check llms.txt
curl https://docs.lafs.dev/llms.txt

# Check page content
curl https://docs.lafs.dev/getting-started/quickstart.md
```

## Sync Behavior

### GitHub → GitBook
- Pushes to `main` branch trigger sync
- Changes appear in GitBook within 1-2 minutes
- SUMMARY.md controls navigation structure

### GitBook → GitHub
- Edits in GitBook create commits on `main`
- Commit message: "GitBook: [description]"
- Changes sync bidirectionally

### Conflict Resolution
- GitBook UI shows conflicts
- Choose "Prefer GitHub" or "Prefer GitBook"
- Recommend: Prefer GitHub for code, GitBook for editorial

## Maintenance

### Adding New Pages

1. Create markdown file in `docs/`
2. Add entry to `docs/SUMMARY.md`
3. Commit and push
4. GitBook auto-syncs

### Updating Navigation

Edit `docs/SUMMARY.md`:

```markdown
# Summary

## Getting Started
* [New Page](path/to/new-page.md)
```

### Versioning with Variants

For versioned docs (v1.0, v2.0):

1. In GitBook, create a **variant**:
   - Go to Space Settings → Variants
   - Create variant: "v2.0"
   - Set as default when ready

2. Or use Git branches:
   - `docs/` on `main` = latest
   - `docs/` on `v1.x` branch = v1.x docs

## Troubleshooting

### Sync Not Working

1. Check GitBook integrations page
2. Verify GitHub App permissions
3. Check `.gitbook.yaml` syntax
4. Ensure SUMMARY.md has valid links

### Broken Links

```bash
# Check all internal links
cd docs
grep -r "\[.*\](.*\.md)" . | grep -v "SUMMARY.md"

# Validate SUMMARY.md
node -e "const fs=require('fs'); const content=fs.readFileSync('SUMMARY.md','utf8'); const links=content.match(/\[.*?\]\((.*?)\)/g)||[]; links.forEach(l=>{const m=l.match(/\((.*)\)/); if(m&&!fs.existsSync(m[1]))console.log('Broken:',m[1])})"
```

### Images Not Displaying

- Use relative paths: `./assets/image.png`
- Store images in `docs/assets/`
- Supported: PNG, JPG, SVG, GIF

## Advanced Configuration

### Site Sections

Combine multiple spaces into one site:

```typescript
// In GitBook API or UI
await client.sites.addSiteSection(siteId, {
  spaceId: apiReferenceSpaceId,
  title: 'API Reference',
});
```

### Visitor Authentication

Protect docs behind login:

1. Space Settings → Visitor Authentication
2. Choose provider (Auth0, Okta, etc.)
3. Configure claims for personalization

### SEO Configuration

GitBook automatically handles:
- Sitemap generation
- Open Graph meta tags
- Structured data

Custom meta descriptions per page:
```markdown
---
description: Learn how to implement LAFS token budgets in your API
---
```

## API Automation

### Programmatic Updates

```typescript
import { GitBookAPI } from '@gitbook/api';

const client = new GitBookAPI({ 
  authToken: process.env.GITBOOK_API_TOKEN 
});

// Trigger sync
await client.spaces.importContentInSpace(spaceId, {
  source: { 
    type: 'github', 
    url: 'https://github.com/kryptobaseddev/lafs-protocol' 
  },
});
```

### CI/CD Integration

```yaml
# .github/workflows/docs.yml
name: Documentation

on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check SUMMARY.md links
        run: |
          cd docs
          grep -oP '\[.*?\]\(\K[^)]+' SUMMARY.md | while read link; do
            if [ ! -f "$link" ]; then
              echo "Broken link: $link"
              exit 1
            fi
          done
      
      - name: Validate JSON examples
        run: |
          npx ajv-cli validate \
            -s schemas/v1/envelope.schema.json \
            -d "fixtures/**/*.json"
```

## Resources

- **GitBook Docs:** https://docs.gitbook.com
- **Git Sync:** https://docs.gitbook.com/integrations/git-sync
- **Custom Domains:** https://docs.gitbook.com/publishing/custom-domains
- **Visitor Auth:** https://docs.gitbook.com/integrations/visitor-authentication

## Support

- GitBook Support: https://docs.gitbook.com/contact
- LAFS Issues: https://github.com/kryptobaseddev/lafs-protocol/issues

---

**Note:** Once configured, documentation updates flow automatically from GitHub to GitBook on every push to `main`.
