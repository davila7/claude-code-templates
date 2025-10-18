# Marketing Skill - Directory Structure & Quick Reference

## Complete Directory Structure

```
marketing-skill/
│
├── SKILL.md                                    ← Main skill file (START HERE)
├── README.md                                   ← Overview and quick start guide
├── IMPLEMENTATION_GUIDE.md                     ← Deployment and customization checklist
├── DIRECTORY_STRUCTURE.md                      ← This file
│
├── reference/                                  ← Core reference materials (one level deep from SKILL.md)
│   ├── campaigns.md                           ← Campaign planning frameworks & templates
│   ├── content.md                             ← Content creation & copywriting guidelines  
│   ├── social_media.md                        ← Platform-specific social strategies
│   ├── email.md                               ← Email marketing best practices & templates
│   ├── analytics.md                           ← Analytics frameworks & KPI definitions
│   ├── brand.md                               ← Brand voice, visual standards, guidelines
│   └── templates.md                           ← Ready-to-use marketing templates
│
├── scripts/                                    ← Executable utility scripts
│   └── marketing_utils.py                     ← Campaign tracking & UTM parameter generator
│                                              (Run: python marketing_utils.py --help)
│
├── examples/                                   ← Sample files for reference
│   └── campaigns_sample.csv                   ← Sample CSV for batch URL generation
│
└── [After customization, you may add]:
    ├── company-templates/                     ← Your company-specific templates
    ├── success-stories/                       ← Documented successful campaigns
    ├── brand-assets/                          ← Brand guidelines, logos, colors
    └── internal-docs/                         ← Your company process docs
```

### File Relationships

```
SKILL.md (Entry point)
  │
  ├─→ reference/campaigns.md
  │   ├─ For: Campaign planning, strategy, ROI calculation
  │   ├─ Use when: Planning a new campaign
  │   └─ Contains: Templates, frameworks, examples
  │
  ├─→ reference/content.md
  │   ├─ For: Copywriting, messaging, content strategy
  │   ├─ Use when: Creating marketing content
  │   └─ Contains: Formulas, guidelines, examples
  │
  ├─→ reference/social_media.md
  │   ├─ For: Platform strategies, best practices
  │   ├─ Use when: Planning social campaigns
  │   └─ Contains: Platform guides, metrics, tactics
  │
  ├─→ reference/email.md
  │   ├─ For: Email marketing, sequences, deliverability
  │   ├─ Use when: Creating email campaigns
  │   └─ Contains: Templates, segmentation, metrics
  │
  ├─→ reference/analytics.md
  │   ├─ For: KPIs, measurement, attribution
  │   ├─ Use when: Setting up measurement, analyzing performance
  │   └─ Contains: Frameworks, KPI definitions, reporting
  │
  ├─→ reference/brand.md
  │   ├─ For: Voice, tone, visual standards
  │   ├─ Use when: Ensuring brand consistency
  │   └─ Contains: Guidelines, standards, examples
  │
  ├─→ reference/templates.md
  │   ├─ For: Ready-to-use templates for all channels
  │   ├─ Use when: Need to quickly create content
  │   └─ Contains: Email, landing page, social, ad templates
  │
  └─→ scripts/marketing_utils.py
      ├─ For: Automated campaign tracking setup
      ├─ Use when: Need to generate UTM parameters
      └─ Contains: Generate, validate, batch URL processing
```

---

## Size & Token Reference

**File sizes** (for understanding context efficiency):

| File | Lines | Type | Purpose |
|------|-------|------|---------|
| SKILL.md | ~300 | Core | Entry point, workflows, principles |
| campaigns.md | ~450 | Reference | Campaign frameworks & templates |
| content.md | ~400 | Reference | Copywriting & content guidelines |
| social_media.md | ~350 | Reference | Platform-specific strategies |
| email.md | ~450 | Reference | Email templates & best practices |
| analytics.md | ~400 | Reference | Analytics & KPI frameworks |
| brand.md | ~350 | Reference | Brand & voice guidelines |
| templates.md | ~500+ | Reference | Ready-to-use templates |
| marketing_utils.py | ~300 | Script | Utility functions |

**Total: ~3,500+ lines** - Comprehensive yet efficient

Each reference file is under 500 lines, allowing Claude to load complete files when needed without excessive context penalty. Files are independent and can be read without loading others.

---

## Quick Reference By Use Case

### "I need to plan a new campaign"
1. Read: [SKILL.md](SKILL.md) → Section "Workflow: Campaign Development & Execution"
2. Use: [reference/campaigns.md](reference/campaigns.md) → "Campaign Development Template"
3. Reference: [reference/analytics.md](reference/analytics.md) → "Success Metrics & Targets"

### "I need to write marketing copy"
1. Read: [reference/content.md](reference/content.md) → "Copywriting Fundamentals"
2. Choose: [reference/templates.md](reference/templates.md) → Select template
3. Customize: Fill template with your specific messaging

### "I need to plan social media content"
1. Read: [reference/social_media.md](reference/social_media.md) → Platform section
2. Use: [reference/social_media.md](reference/social_media.md) → "Social Media Campaign Framework"
3. Reference: [reference/templates.md](reference/templates.md) → "Social Media Content Calendar Template"

### "I need to send an email campaign"
1. Choose: [reference/email.md](reference/email.md) → Email type (welcome, nurture, promotional)
2. Use: [reference/templates.md](reference/templates.md) → Email template
3. Reference: [reference/email.md](reference/email.md) → Best practices & metrics

### "I need to measure campaign performance"
1. Read: [reference/analytics.md](reference/analytics.md) → "Marketing Funnel Framework"
2. Define: [reference/analytics.md](reference/analytics.md) → "Essential Marketing KPIs"
3. Implement: [scripts/marketing_utils.py](scripts/marketing_utils.py) → Generate tracking URLs

### "I need to ensure brand consistency"
1. Read: [reference/brand.md](reference/brand.md) → "Brand Voice & Tone"
2. Reference: [reference/brand.md](reference/brand.md) → "Visual Branding" & "Campaign Creative Guidelines"
3. Use: Throughout all campaigns

### "I need to set up campaign tracking"
1. Run: `python scripts/marketing_utils.py --help`
2. Use: [scripts/marketing_utils.py](scripts/marketing_utils.py) examples
3. Batch generate: From [examples/campaigns_sample.csv](examples/campaigns_sample.csv)

---

## Navigation Tips

### For Beginners
**Start with**: README.md → SKILL.md → One reference file based on your current need

**Suggested First Tasks**:
1. Read SKILL.md core principles
2. Work through campaign planning template
3. Choose a content type and use ready-made template
4. Define success metrics

### For Experienced Marketers
**Start with**: Specific reference file based on current task

**Advanced Features**:
1. Use custom attribution models (analytics.md)
2. Implement A/B testing frameworks (email.md, content.md)
3. Scale campaigns using batch tools (scripts/marketing_utils.py)
4. Create custom audience segments (campaigns.md)

### For Skill Customization
**Start with**: IMPLEMENTATION_GUIDE.md → Reference files for customization

**Customization Priority**:
1. Brand guidelines (brand.md)
2. Terminology (all files)
3. Audience types (campaigns.md)
4. Company-specific examples (templates.md)
5. Analytics tools & targets (analytics.md)

---

## File Dependencies & Links

**No file depends on other files being loaded** - This is by design.

- Each reference file is self-contained
- No circular references between files
- All links point FROM reference files, not between them
- SKILL.md is the only entry point

This architecture ensures:
- ✓ Efficient context usage
- ✓ Parallel loading of information
- ✓ No broken reference chains
- ✓ Easy file updates without cascading changes

---

## Updating & Maintenance

### When to Add New Content
- New template proves effective → Add to templates.md
- Company process changes → Update SKILL.md workflow
- New platform used → Add to social_media.md
- New audience identified → Add to campaigns.md

### When to Remove Content
- Framework becomes outdated → Remove from relevant file
- Tool is no longer used → Remove from analytics.md
- Template never used → Remove from templates.md

### When to Reorganize
- File approaches 500 lines → Split into new file or move content
- Reference section becomes self-contained → Create new file
- Multiple sections address same topic → Consolidate

---

## Backward Compatibility

**Current Version**: 1.0 (October 2025)

This skill is designed to work with:
- Claude Opus 4.1
- Claude Sonnet 4.5  
- Claude Haiku 4.5

**Future Versions**: Structure designed to accommodate additions without breaking existing references.

---

## Quick Copy-Paste Sections

### File Paths (Forward Slashes - Always)
```
✓ reference/campaigns.md
✓ scripts/marketing_utils.py
✓ examples/campaigns_sample.csv

✗ reference\campaigns.md    (Wrong - backslash)
✗ docs/reference/campaigns  (Wrong - missing .md)
```

### Link Format (Markdown)
```
[Text to display](reference/filename.md)
[View campaign template](reference/campaigns.md#campaign-development-template)
```

### Running Script
```bash
python scripts/marketing_utils.py generate_utm \
  --source "email" \
  --medium "newsletter" \
  --campaign "Q3_launch"
```

---

## Accessibility Notes

All files are:
- **Plain text markdown** (.md) - Accessible to all tools and systems
- **Readable formatting** - Clear structure with headers and sections  
- **No special characters** - Uses only ASCII characters and markdown formatting
- **Searchable** - All text is full-text searchable
- **Linkable** - Each section can be linked to by URL/reference

---

## Storage & Sharing

The complete skill folder can be:
- **Shared** - Copy entire folder to team members
- **Backed up** - Store in version control (git)
- **Deployed** - Upload to Claude skill system
- **Customized** - Modify files for your company
- **Extended** - Add new files while maintaining structure

**Recommended**: Store in git repository for version tracking and collaboration.

---

**Last Updated**: October 2025
**Version**: 1.0
**Compatible Models**: Claude 4 family (Opus 4.1, Sonnet 4.5, Haiku 4.5)
