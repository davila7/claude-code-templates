# Marketing Skill Implementation Guide

## Deployment Checklist

Use this checklist to ensure the Marketing Skill is properly deployed and ready for your team.

### Phase 1: Preparation (Before Deployment)

**File Structure Validation**
- [ ] All files created in correct locations with proper structure
- [ ] SKILL.md exists in root directory with proper YAML frontmatter
- [ ] All reference files in `/reference/` directory
- [ ] Python script in `/scripts/` directory
- [ ] Sample files in `/examples/` directory
- [ ] README.md in root directory

**File Content Verification**
- [ ] SKILL.md has required frontmatter (name: 64 chars max, description: 1024 chars max)
- [ ] All reference files use markdown format (.md)
- [ ] Python script is executable and tested
- [ ] Links between files use correct relative paths (forward slashes)

**Quality Review**
- [ ] No typos in SKILL.md or reference files
- [ ] Terminology is consistent throughout
- [ ] All internal links tested and working
- [ ] Code in scripts directory is well-commented
- [ ] Examples folder contains realistic sample data

### Phase 2: Customization (Modify for Your Company)

**Brand & Voice Standards**
- [ ] Update [reference/brand.md](../reference/brand.md):
  - [ ] Add your company brand voice guidelines
  - [ ] Include actual color codes and typography
  - [ ] Add your logo usage guidelines
  - [ ] Include visual examples/screenshots

**Terminology & Audience**
- [ ] Review consistent terminology throughout (search and replace if needed)
- [ ] Update [reference/campaigns.md](../reference/campaigns.md) with your audience types
- [ ] Add your specific campaign types and examples
- [ ] Include your company-specific KPIs in [reference/analytics.md](../reference/analytics.md)

**Company-Specific Content**
- [ ] Update [reference/templates.md](../reference/templates.md) with your:
  - [ ] Company email signature format
  - [ ] Standard CTA language
  - [ ] Product/feature names
  - [ ] Common messaging examples

**Tools & Systems**
- [ ] Update [reference/analytics.md](../reference/analytics.md) with your actual tools:
  - [ ] Analytics platform (Google Analytics, Mixpanel, etc.)
  - [ ] Email platform (HubSpot, Mailchimp, etc.)
  - [ ] CRM system
  - [ ] Paid advertising platforms used

**Links & Resources**
- [ ] Update documentation links to point to your internal resources
- [ ] Add links to your brand guidelines if they exist elsewhere
- [ ] Include links to your analytics dashboard
- [ ] Link to your content management system

### Phase 3: Testing (Verify Skill Works)

**Functionality Tests**

**Test 1: Campaign Planning**
- [ ] Load SKILL.md and reference campaigns.md
- [ ] Work through campaign development template
- [ ] Verify all sections are accessible
- [ ] Check that examples are relevant

**Test 2: Content Creation**
- [ ] Request email template from [reference/templates.md](../reference/templates.md)
- [ ] Request copywriting guidance from [reference/content.md](../reference/content.md)
- [ ] Verify templates are usable and complete
- [ ] Check all formulas and examples load correctly

**Test 3: Social Media**
- [ ] Request platform-specific strategy from [reference/social_media.md](../reference/social_media.md)
- [ ] Verify platform metrics and recommendations are accurate
- [ ] Test content calendar template

**Test 4: Analytics**
- [ ] Request KPI recommendations from [reference/analytics.md](../reference/analytics.md)
- [ ] Verify metrics match your company's measurement approach
- [ ] Check if dashboard templates are useful

**Test 5: Script Execution**
- [ ] Run marketing_utils.py generate_utm command
- [ ] Run marketing_utils.py build_url command
- [ ] Test batch mode with [examples/campaigns_sample.csv](../examples/campaigns_sample.csv)
- [ ] Verify output accuracy

**Performance Tests**

**Token Usage**
- [ ] SKILL.md body is under 500 lines ✓
- [ ] Reference files are at appropriate length
- [ ] No unnecessary repetition between files
- [ ] Files load efficiently without excessive context

**Load Tests**
- [ ] Test with Haiku model (fast, economical)
- [ ] Test with Sonnet model (balanced)
- [ ] Test with Opus model (powerful reasoning)
- [ ] Verify consistent behavior across models

### Phase 4: Deployment

**Make Skill Available**
- [ ] Upload all files to skill repository/system
- [ ] Verify file structure matches expected format
- [ ] Test that Claude can access all files
- [ ] Confirm skill appears in available skills list

**Team Onboarding**
- [ ] Share README.md with team
- [ ] Provide quick start guide (specific to your company)
- [ ] Schedule skill training/demo session
- [ ] Create internal documentation on how to use

**Process Documentation**
- [ ] Document your standard campaign workflow
- [ ] Create quick reference guides for common tasks
- [ ] Establish when to use each reference file
- [ ] Document any customizations you made

### Phase 5: Optimization (After Initial Use)

**Monitor Usage**
- [ ] Track which parts of the skill are used most
- [ ] Note any confusion or questions from team
- [ ] Collect feedback on missing information
- [ ] Track time saved vs. previous approach

**Iterative Improvements**
- [ ] Update based on team feedback
- [ ] Add company-specific examples as they arise
- [ ] Refine terminology based on actual usage
- [ ] Improve unclear sections
- [ ] Add new templates based on common needs

**Knowledge Capture**
- [ ] Document successful campaign patterns discovered
- [ ] Add new audience types as you identify them
- [ ] Update analytics with actual performance data
- [ ] Share lessons learned with team

---

## Customization Template

When customizing the skill for your company, use this template:

### 1. Company Information
- **Company Name**: [Your Company]
- **Industry**: [Your Industry]
- **Primary Products/Services**: [List]
- **Target Audience**: [Description]
- **Key Competitors**: [List]

### 2. Brand Voice
- **Tone**: [Describe your brand tone]
- **Key Personality Traits**: [List 3-5]
- **Language Style**: [Formal/Casual/Technical/etc.]
- **Examples of Good Marketing**: [Reference examples]

### 3. Marketing Channels
- **Primary Channels**: [Channels you actively use]
- **Secondary Channels**: [Channels to test]
- **Channel Responsibilities**: [Who owns each]
- **Tools Used**: [Your marketing tech stack]

### 4. Audience Segments
- **Segment 1**: [Name]
  - Demographics: [Details]
  - Pain points: [List]
  - Preferred channels: [Channels]
  - Messaging approach: [Approach]

- **Segment 2**: [Name]
  - [Repeat above structure]

### 5. Key Metrics & Targets
- **Primary KPI**: [Metric] - Target: [Number]
- **Secondary KPI**: [Metric] - Target: [Number]
- **Industry Benchmarks**: [Reference data]
- **Historical Performance**: [Baseline data]

### 6. Messaging Framework
- **Core Value Prop**: [Your unique value]
- **Key Messages** (3-5):
  1. [Message]
  2. [Message]
  3. [Message]
- **Competitive Positioning**: [How you differ]

### 7. Campaign Types
- **Most Common**: [Campaign type]
- **Frequency**: [How often]
- **Budget**: [Typical allocation]
- **Expected ROI**: [Historical performance]

---

## Common Customization Updates

### Update 1: Email Signature
**File**: reference/templates.md - Email Template Section

Replace:
```
[Your Name]
[Your Title]
[Your Contact Info]
```

With your actual format:
```
Sarah Johnson
Director of Marketing
sarah@company.com | +1-555-123-4567
company.com
```

### Update 2: Brand Colors
**File**: reference/brand.md - Color Palette Section

Replace:
```
- Primary: [Color] - Hex: [#000000]
- Accent 1: [Color] - Hex: [#000000]
```

With your actual colors:
```
- Primary: Blue - Hex: #0066CC
- Accent 1: Orange - Hex: #FF6600
```

### Update 3: Audience Types
**File**: reference/campaigns.md - Audience Research Section

Add your specific segments:

Original:
```
When developing campaigns, consider:
- Target audience profiles
- Pain points
- Buying process
```

Customized:
```
Our target audiences:
1. C-Suite (CEO, CFO, CRO)
   - Focus: ROI, revenue impact, strategic outcomes
   
2. Department Heads (VP, Director)
   - Focus: Implementation, team adoption, resource requirements
   
3. Practitioners (Manager, Specialist)
   - Focus: Ease of use, workflow improvements, adoption
```

### Update 4: Company Tools
**File**: reference/analytics.md - Analytics Tools Section

Update tools list with your actual stack:

Original:
```
**Email Analytics**
- Mailchimp, HubSpot, Klaviyo (built-in email metrics)
```

Customized:
```
**Email Analytics**
- HubSpot (our email platform)
  - Dashboard: https://app.hubspotcom/reports/[account]
  - Team access: All marketing team members
  - Reporting: Daily digest sent to #marketing channel
```

---

## Troubleshooting Deployment Issues

**Issue**: Files not loading
**Solution**: Verify file paths use forward slashes and are relative to SKILL.md location

**Issue**: Links between files broken
**Solution**: Check that all links use proper markdown format: `[text](path/to/file.md)`

**Issue**: Skill not appearing
**Solution**: Verify SKILL.md frontmatter has exactly `name` and `description` fields

**Issue**: Python script not executing
**Solution**: Verify script has execute permissions and Python 3 is available in environment

**Issue**: Terminology confusion
**Solution**: Run find-and-replace to update terminology consistently across all files

---

## Maintenance Schedule

### Monthly
- [ ] Review team feedback and usage patterns
- [ ] Update templates based on recent successful campaigns
- [ ] Refresh examples with current company data
- [ ] Verify all links are still working

### Quarterly
- [ ] Update analytics targets based on performance
- [ ] Add new audience segments discovered
- [ ] Review competitive landscape for positioning updates
- [ ] Refresh content calendar examples

### Annually
- [ ] Major review of brand guidelines
- [ ] Update with new channels/platforms if adopted
- [ ] Refresh all examples to reflect current company state
- [ ] Conduct team training refresher

---

## Success Metrics for Skill Implementation

Track these to measure skill effectiveness:

**Adoption Metrics**
- % of team using the skill regularly
- Frequency of skill usage
- Time spent per interaction

**Efficiency Metrics**
- Time to create campaign strategy (before vs. after)
- Time to generate content (before vs. after)
- Consistency of team output

**Quality Metrics**
- Marketing message consistency scores
- Campaign effectiveness (ROI improvement)
- Team satisfaction with templates/guidance

**Business Impact**
- Campaign performance improvement
- Team productivity increase
- Marketing velocity improvement

---

## Questions or Issues?

- **Content questions**: See relevant reference file
- **Technical issues**: Check file structure and verify all files uploaded
- **Customization help**: Use the template in "Customization Template" section
- **New feature requests**: Document in quarterly review and add to next update
