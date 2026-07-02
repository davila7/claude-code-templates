---
name: job-description-analyzer
description: Analyze job postings, calculate match scores, identify gaps, and create an application strategy. Use when the user shares a job description or asks to evaluate fit, match score, or gaps against a posting.
---

# Job Description Analyzer

## When to Use This Skill

Use this skill when the user:
- Wants to analyze a job posting
- Asks "should I apply to this job?"
- Wants to know their match percentage for a role
- Needs help understanding job requirements
- Wants to tailor their resume for a specific position
- Mentions: "analyze this job", "am I qualified", "match score", "should I apply"

Use this BEFORE resume tailoring to ensure effort is worth it.

## Core Capabilities

- Extract and categorize job requirements (must-have vs nice-to-have)
- Calculate match score between user's experience and job requirements
- Identify skill gaps and strengths
- Detect red flags in job postings
- Prioritize which experiences to highlight
- Generate resume tailoring strategy
- Create cover letter talking points
- Assess company culture fit indicators

## The Strategic Problem

Most job seekers waste time on:
- Jobs they're under-qualified for (<60% match)
- Jobs they're over-qualified for (flight risk)
- Jobs with red flags (high turnover, toxic culture)
- Applying to 50+ jobs blindly hoping something sticks

Better approach:
- Apply to 10-15 jobs strategically
- Target 70-90% match jobs
- Customize deeply for each
- Higher response rate, less burnout

## Analysis Process

### Step 1: Extract Requirements

Break job description into categories:

**Required (Must-Have)**
- Education requirements
- Years of experience
- Specific technical skills
- Certifications/licenses
- Industry experience

**Preferred (Nice-to-Have)**
- "Bonus" skills
- Advanced certifications
- Domain expertise
- Specific tool experience

**Soft Skills/Culture**
- Communication style
- Work environment
- Team structure
- Company values

### Step 2: Keyword Extraction

Identify three types:

**Hard Skills** (Technical abilities)
- Tools: Salesforce, Python, AWS, Excel
- Methodologies: Agile, Six Sigma, SDLC
- Certifications: PMP, CPA, AWS Certified

**Soft Skills** (Interpersonal)
- Leadership, collaboration, communication
- Problem-solving, critical thinking
- Adaptability, initiative

**Industry/Domain Knowledge**
- B2B SaaS, healthcare, fintech
- Enterprise vs SMB
- Regulatory knowledge (HIPAA, SOX, GDPR)

### Step 3: Calculate Match Score

```
MATCH CALCULATION:

Required Skills:
- User has 8 out of 10 required = 80%

Preferred Skills:
- User has 3 out of 5 preferred = 60%

Overall Match:
- Weight required 70%, preferred 30%
- (80% × 0.7) + (60% × 0.3) = 74%

INTERPRETATION:
90-100% = Overqualified (may be flight risk)
75-89% = Excellent fit (apply immediately)
60-74% = Good fit (apply with strong cover letter)
50-59% = Stretch role (apply if passionate)
<50% = Under-qualified (skip unless dream job)
```

### Step 4: Gap Analysis

For each missing requirement:
- **Critical gap**: Deal-breaker (don't apply)
- **Major gap**: Significant but addressable (mention in cover letter)
- **Minor gap**: Easy to learn (downplay or emphasize related skills)

### Step 5: Red Flag Detection

Scan for warning signs:

**Workload Red Flags:**
- "Wear many hats"
- "Fast-paced environment"
- "Hit the ground running"
- "Self-starter in ambiguous situations"

**Culture Red Flags:**
- "Rockstar/Ninja/Guru"
- "We work hard, play hard"
- "Unlimited vacation"
- "Like a family"

**Compensation Red Flags:**
- "Competitive salary" (won't tell you range)
- "Equity-heavy" (low cash compensation)
- "Commission-based" (no base salary)
- "DOE" with no range

## Match Score Output Format

```markdown
# JOB ANALYSIS REPORT

**Position:** Senior Product Manager
**Company:** TechCorp Inc.
**Location:** San Francisco, CA (Hybrid)
**Salary Range:** $140K-$180K + equity

═══════════════════════════════════════════

## OVERALL MATCH SCORE: 78% ✅

**Recommendation:** STRONG FIT - Apply within 48 hours

**Application Priority:** HIGH
**Estimated Competition:** Medium (Posted 2 days ago)
**Time to Tailor Resume:** 30-45 minutes

═══════════════════════════════════════════

## REQUIREMENTS BREAKDOWN

### Required Skills - 8/10 ✅

✅ 5+ years product management (You have: 6 years)
✅ B2B SaaS experience (You have: 4 years)
✅ Agile/Scrum (You have: 5 years)
✅ Cross-functional leadership (You have: Strong experience)
✅ Data-driven decision making (You have: 3 years analytics)
✅ API products (You have: 2 years)
✅ Roadmap planning (You have: Extensive)
✅ User research (You have: 2 years)
❌ SQL/data analysis (You have: Basic Excel only) ⚠️
❌ Mobile product experience (You don't have) ⚠️

### Preferred Skills - 4/6 ✅

✅ MBA or equivalent (You have: MBA from UC Berkeley)
✅ Developer tools experience (You have: 2 years)
✅ Payment systems (You have: 1 year)
✅ International markets (You have: Worked with EU teams)
❌ E-commerce background (You don't have)
❌ Machine learning products (You don't have)

### Soft Skills - 5/5 ✅

✅ Stakeholder management (Strong mentions in your resume)
✅ Communication (You present regularly)
✅ Strategic thinking (MBA + senior experience)
✅ Influence without authority (You've done this)
✅ Customer empathy (User research experience)

═══════════════════════════════════════════

## STRENGTHS TO EMPHASIZE

**Your Top 3 Selling Points:**

1. **B2B SaaS PM Experience**
   - 4 years in SaaS, exactly what they want
   - Lead with this in resume summary

2. **API Product Background**
   - Your developer tools experience is highly relevant
   - This differentiates you from other candidates

3. **Data-Driven Approach**
   - Your analytics background addresses their need
   - Emphasize metrics and data in every bullet

═══════════════════════════════════════════

## GAPS TO ADDRESS

**Critical Gaps:** None ✅

**Major Gaps:**
⚠️ **SQL/Data Analysis**
- They mention this 5x in job description
- They want PM who can query data independently

**Strategy:**
- Don't avoid this gap
- Address in cover letter: "While my primary analytics work has been in Excel and BI tools, I'm actively learning SQL through DataCamp and can currently write basic queries"
- Emphasize your data-driven mindset and collaboration with data team

**Minor Gaps:**
- Mobile product experience (mentioned 2x)
- Not a dealbreaker - they want "any product," mobile just a plus

**Strategy:**
- Don't mention this gap
- If asked in interview, pivot to "transferable product skills"

═══════════════════════════════════════════

## RESUME CUSTOMIZATION STRATEGY

### Priority 1: Lead with Most Relevant Experience

**Current Resume Order:**
1. Company ABC - General PM work
2. Company XYZ - Your developer tools role
3. Company 123 - Early career

**Recommended Order:**
1. Company XYZ - Developer tools role (MOST RELEVANT)
2. Company ABC - B2B SaaS work
3. Company 123 - Only if space allows

### Priority 2: Keyword Integration

**Add These Exact Phrases:**
- "SQL and data analysis" (mentioned 5x in JD)
- "API product management" (mentioned 4x)
- "Developer-focused products" (mentioned 3x)
- "Stakeholder alignment" (mentioned 3x)

**Where to Add:**
- Professional Summary: Mention "API products" and "data-driven"
- Skills Section: Add "SQL (basic), Data Analysis, API Design"
- Experience: Weave into existing bullets

### Priority 3: Quantify Everything

They mention "metrics" and "KPIs" 7 times total.

**Enhance These Bullets:**

Current: "Led product roadmap"
Better: "Defined product roadmap based on analysis of 50+ customer interviews and usage data from 100K+ users"

Current: "Launched new features"
Better: "Launched 8 features in 12 months, increasing user engagement by 35% and reducing churn by 20%"

═══════════════════════════════════════════

## COVER LETTER TALKING POINTS

### Opening Hook (Choose One):

**Option 1 - Specific Company Knowledge:**
"I noticed TechCorp recently launched your API marketplace - I've spent the last 2 years as PM for a developer tools platform, and I'm excited about the opportunity to bring that experience to your growing API ecosystem."

**Option 2 - Mutual Connection:**
"[Name] on your product team mentioned you're looking for a PM to lead the API product line - my 2 years in developer tools and B2B SaaS background would be a strong fit."

**Option 3 - Problem-Solver:**
"Your JD mentions challenges in stakeholder alignment across technical teams - I've navigated this exact challenge at my current role, aligning engineering, design, and sales teams across 6 concurrent product initiatives."

### Body - Address the Match:
- "Your requirement for B2B SaaS experience: I have 4 years with..." 
- "Your focus on data-driven decisions: In my current role, I..."
- "Your need for API product expertise: At [Company], I..."

### Addressing SQL Gap (Optional):
"While my data analysis has primarily been in Excel and Tableau, I'm expanding my SQL skills and can currently write basic queries. More importantly, I've built strong partnerships with data teams and consistently use data to inform product decisions."

═══════════════════════════════════════════

## RED FLAGS ANALYSIS

### Potential Concerns: ⚠️ MINOR

**Flag 1:** "Fast-paced environment"
- Appears 2x in description
- Interpretation: Likely startup or high-growth
- May mean: Long hours, ambiguity, rapid changes

**Flag 2:** Salary range is wide ($140K-$180K)
- 29% spread
- May indicate: Experience range is flexible, or negotiation room

### Positive Signals: ✅

**Signal 1:** Detailed job description
- Shows company knows what they want
- Well-organized role

**Signal 2:** Mentions specific tools (JIRA, Amplitude)
- Shows operational maturity

**Signal 3:** Hybrid flexibility mentioned
- Modern workplace practices

### Company Research Needed:

Before applying, check:
- Glassdoor reviews (look for patterns in 1-2 star reviews)
- Recent funding/news (layoffs? growth?)
- LinkedIn: Check how long people stay (high turnover?)
- Levels.fyi: Verify salary range is accurate

═══════════════════════════════════════════

## APPLICATION TIMELINE

**✅ Day 1 (Today):**
- Customize resume (30-45 minutes)
- Write cover letter (30 minutes)

**✅ Day 1-2:**
- Submit application
- Connect with 2-3 current employees on LinkedIn
- Research company more deeply

**✅ Week 1:**
- Follow up if no response after 7 days

**📊 Expected Response Time:** 1-2 weeks

**📊 Interview Process (from job posting):**
1. Recruiter screen (30 min)
2. Hiring manager (1 hour)
3. Product case study (take-home)
4. Team interviews (3-4 hours)
5. Executive interview (1 hour)

═══════════════════════════════════════════

## DECISION FACTORS

### Reasons to Apply ✅

1. Strong match (78%) - You meet most requirements
2. Role aligns with career goals
3. Salary range is appropriate for your experience
4. Company stage fits your preferences
5. You have unique relevant experience (developer tools)

### Reasons to Hesitate ⚠️

1. SQL gap is real - prepare to address this
2. "Fast-paced" may mean high pressure
3. Need to research company culture more

### Overall Recommendation:

**APPLY - This is a strong opportunity**

You meet 80% of required skills and 67% of preferred skills. Your developer tools and B2B SaaS experience makes you a differentiated candidate. The SQL gap is addressable with honesty and emphasis on your analytical skills. Apply within 48 hours while posting is fresh.
```

## Requirement Classification Guide

### Identifying "Must Have" vs "Nice to Have"

**Language indicating REQUIRED:**
- "Must have..."
- "Required: X years of..."
- "You have..."
- "Essential qualifications"
- Listed under "Requirements"
- Mentioned 3+ times in description

**Language indicating PREFERRED:**
- "Nice to have..."
- "Bonus if you have..."
- "Preferred qualifications"
- "Ideally, you'd have..."
- "A plus if..."
- Mentioned only 1-2 times

### Dealbreaker Detection

**Absolute dealbreakers (don't apply):**
- Required license you don't have (medical, legal, CPA)
- Required clearance you can't get
- Years of experience 50%+ below requirement
- Required degree you don't have (when stated as "required")
- Location requirement you can't meet

**Not dealbreakers (apply anyway):**
- Years of experience slightly below (e.g., 3 years when they want 5)
- "Preferred" degree you don't have
- Nice-to-have tools/skills you can learn
- Industry experience when you have transferable skills

## Implementation Checklist

When analyzing a job:

1. ✅ Extract all requirements (required vs preferred)
2. ✅ Identify all keywords (hard skills, soft skills, industry terms)
3. ✅ Calculate match score
4. ✅ Identify strengths to emphasize
5. ✅ Identify gaps and strategies to address
6. ✅ Detect red flags
7. ✅ Create resume customization plan
8. ✅ Generate cover letter talking points
9. ✅ Research company
10. ✅ Provide application recommendation and timeline

## Edge Cases

### Vague Job Descriptions
- Flag as potential red flag
- Extract what keywords you can
- Recommend reaching out for clarity before applying
- Use industry standard requirements as baseline

### Multiple Roles in One JD
- Identify the core role vs "other duties"
- Focus match score on primary responsibilities
- Flag scope creep concerns

### Internal Postings (Already Working There)
- Different strategy - emphasize internal knowledge
- Highlight cross-team relationships
- Reference specific company initiatives

### Reposted Jobs
- May indicate: Previous hire didn't work out, role expanded, or first search failed
- Worth applying, but research why it was reposted
- Check if requirements changed from original posting
