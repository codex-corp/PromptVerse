export interface EngineeringTemplate {
    id: string;
    title: string;
    objective: string;
    scenario: string;
    standard: string;
    chatgpt: string;
    tags: string[];
}

export interface TemplateCategory {
    id: string;
    title: string;
    description: string;
    templates: EngineeringTemplate[];
}

export const ENGINEERING_TEMPLATE_CATEGORIES: TemplateCategory[] = [
    {
        id: "shipping",
        title: "Ship features with confidence",
        description: "Use these when you need to accelerate delivery without sacrificing quality.",
        templates: [
            {
                id: "code-review-risk-radar",
                title: "Code review risk radar",
                objective: "Surface regressions, missing tests, and risky diffs before merging.",
                scenario:
                    "Share pull request context when you want another set of expert eyes on logic, edge cases, and alignment with team standards.",
                tags: ["code review", "quality", "tests"],
                standard: `Review the following pull request with the mindset of a staff engineer.

Project context:
- Repository / product area: [product or service]
- Customer impact if broken: [describe blast radius]
- Team standards to enforce: [docs/tests/perf/etc]

Change summary provided by author:
[paste summary or PR description]

Key files and diffs:
[paste diff or relevant files]

What I need back:
1. High-risk regressions or undefined behaviour.
2. Follow-up questions where intent is unclear.
3. Gaps in testing coverage with concrete test ideas.
4. Any architectural or dependency concerns to flag before ship.
5. Suggested commit-level comments (line references helpful).

Return the review in plain text with clear sections for Findings, Questions, and Next actions.`,
                chatgpt: `/ROLE: Staff Engineer & Code Review Lead
/TASK: Audit the following pull request for regressions, missing tests, and architectural concerns. Provide line-specific guidance where possible.
/FORMAT: Checklist + Inline suggestions + Risk summary
/CONTEXT: Repository=[name]; Criticality=[blast radius]; Standards=[testing, performance, docs]; Change summary=[paste]; Diff=[paste relevant sections]
/QUALITY BAR: Block on correctness, high-risk regressions, or missing coverage; note polish items separately.
/ASK: If intent is unclear, ask 3 focused questions before reviewing.

/STEP-BY-STEP — walk through the diff from most risky to least.
/CHECKLIST — produce merge blockers, follow-ups, and polish actions.
/DEV MODE — keep feedback direct, cite affected files/lines.

Return sections: Merge Blockers, High Priority, Questions, Test Gaps, Nice-to-haves.`,
            },
            {
                id: "architecture-trade-study",
                title: "Architecture trade study",
                objective: "Compare implementation approaches with trade-offs, risks, and decision rubric.",
                scenario:
                    "Use when exploring alternatives for a new system or refactor and you need a structured decision document quickly.",
                tags: ["architecture", "design", "trade-offs"],
                standard: `Act as a principal engineer helping a team choose an approach.

Project background:
- Problem we are solving: [describe]
- Existing constraints: [tech stack, non-functionals, timelines]
- Options under consideration: [Option A], [Option B], [Option C]
- Key success criteria: [scale, latency, DX, cost]

What to deliver:
1. Option summaries with key components and integration points.
2. Comparative analysis table covering pros/cons, effort, risk, and mitigation ideas.
3. Open questions or spikes needed to de-risk the favorite option.
4. Recommendation with rationale tied to success criteria.
5. Suggested next steps (stakeholders, docs, experiments).

Return the response in markdown.`,
                chatgpt: `/ROLE: Principal Engineer facilitating an architecture decision
/TASK: Compare and recommend between multiple implementation options for [describe problem].
/FORMAT: Table + Bullet narrative + Decision memo
/CONTEXT: Constraints=[tech stack, SLA, deadlines]; Options=[Option A, Option B, Option C]; Success criteria=[list]
/QUALITY BAR: Advice must be actionable within current team capacity and surface material risks.
/ASK: Clarify assumptions if required before recommending.

/CHAIN OF THOUGHT — reason through trade-offs explicitly.
/DELIBERATE THINKING — weigh effort, complexity, risk, and timeline.
/CHECKLIST — outline next steps and validation tasks.

Return sections: Option Summaries, Comparison Table, Risk Mitigations, Recommendation, Next Steps.`,
            },
        ],
    },
    {
        id: "quality",
        title: "Improve reliability & testing",
        description: "Lean on these when stability, debugging, or test strategy is the priority.",
        templates: [
            {
                id: "debugging-game-plan",
                title: "Debugging game plan",
                objective: "Generate a targeted investigation plan for a flaky or failing scenario.",
                scenario: "Perfect for time-boxed incident triage or when pairing with AI on a stubborn bug.",
                tags: ["debugging", "incidents", "root cause"],
                standard: `Help plan a debugging investigation as a senior engineer.

Failure description:
- Symptoms observed: [what users or logs show]
- When it started: [time window]
- Systems involved: [services, jobs, queues]
- Recent changes or deployments: [list]
- Existing logs / metrics snippet: [paste]

Output a plan that includes:
1. Hypotheses ranked by likelihood with reasoning.
2. Signals or telemetry to verify or falsify each hypothesis.
3. Fast experiments or instrumentation to add.
4. Rollback / mitigation options if impact escalates.
5. Owners or teams to loop in.

Respond in markdown.`,
                chatgpt: `/ROLE: Staff SRE & Debugger
/TASK: Build a focused investigation plan to chase down the failure described.
/FORMAT: Hypothesis table + Timeline checklist
/CONTEXT: Symptoms=[describe]; Systems=[list]; Recent changes=[list]; Observability=[logs/metrics pasted]
/QUALITY BAR: Time-to-mitigation < 30 mins; prioritise high blast radius hypotheses first.
/ASK: Surface any missing signals you need before proceeding.

/STEP-BY-STEP — order hypotheses from most to least likely.
/CHECKLIST — produce a verification plan with owners and expected signals.
/CONTEXT STACK — call out upstream/downstream systems that might be involved.

Return sections: Hypotheses, Verification Steps, Immediate Mitigations, Follow-up Tasks.`,
            },
            {
                id: "test-strategy-booster",
                title: "Test strategy booster",
                objective: "Outline pragmatic unit, integration, and regression tests for a change or legacy module.",
                scenario:
                    "Use when you need to harden coverage for a feature, refactor, or bug fix and want AI to enumerate concrete test ideas.",
                tags: ["testing", "quality", "automation"],
                standard: `Draft a test strategy for the following context.

Feature / module: [name]
Business impact of regression: [describe]
Tech stack + frameworks: [list]
Known risk areas: [legacy modules, brittle integrations]
Existing tests: [what exists today]
Upcoming change summary: [describe or paste diff]

What to produce:
1. Key behaviours to validate.
2. Suggested unit, integration, and end-to-end tests with tooling recommendations.
3. Edge cases, failure scenarios, and telemetry assertions.
4. Automation backlog: quick wins vs longer-term investments.
5. Ownership or follow-up notes.

Return markdown with clear subsections.`,
                chatgpt: `/ROLE: Senior QA Automation Engineer
/TASK: Propose a layered test plan for [feature/module] considering the incoming change.
/FORMAT: Table + Bullet lists
/CONTEXT: Stack=[list]; Risk areas=[list]; Change summary=[paste]; Existing coverage=[describe]; Business impact=[describe]
/QUALITY BAR: Prioritise tests that reduce regression risk and catch failures early in CI.
/ASK: Raise up to 3 clarifying questions if assumptions are missing.

/CHECKLIST — enumerate specific test scenarios.
/SCHEMA — suggest structured data for fixtures or mocks.
/DEV MODE — keep guidance concise and action-oriented.

Return sections: Critical Behaviours, Test Matrix, Automation Backlog, Observability Hooks.`,
            },
        ],
    },
    {
        id: "operations",
        title: "Operational readiness",
        description: "Templates to manage production incidents, migrations, and knowledge sharing.",
        templates: [
            {
                id: "migration-runbook",
                title: "Migration runbook",
                objective: "Draft a sequenced rollout plan with guardrails and rollback paths.",
                scenario:
                    "Reach for this when coordinating a schema/data/platform migration that spans multiple teams or environments.",
                tags: ["migration", "runbook", "operations"],
                standard: `Help plan a safe migration.

Target change:
- What we are migrating: [describe]
- Current vs target state: [summarise]
- Environments impacted: [dev/staging/prod]
- Deadlines & freeze windows: [list]
- Known risks: [performance, data integrity, downtime]

Deliver:
1. Phased rollout plan (prep, dry run, production).
2. Preconditions and readiness checklist.
3. Rollback / contingency plan per phase.
4. Communication checklist (stakeholders, status updates).
5. Monitoring or alerting to watch during the migration.

Return the runbook in markdown.`,
                chatgpt: `/ROLE: Site Reliability Engineer & Migration Lead
/TASK: Build a phased migration playbook for [describe migration].
/FORMAT: Table + Checklist + Timeline
/CONTEXT: Current state=[describe]; Target state=[describe]; Environments=[list]; Deadlines=[list]; Risks=[list]
/QUALITY BAR: Zero data loss, defined rollback under 10 minutes, comms ready for stakeholders.
/ASK: Identify any prerequisites or sign-offs needed.

/STEP-BY-STEP — outline phases with owners and exit criteria.
/CHECKLIST — capture readiness, execution, and validation tasks.
/BEGIN WITH summary, /END WITH next steps.

Return sections: Overview, Phase Plan, Rollback Matrix, Monitoring, Communications.
`,
            },
            {
                id: "incident-postmortem",
                title: "Incident postmortem accelerator",
                objective: "Summarise impact, timeline, root cause, and follow-ups after a production issue.",
                scenario:
                    "Use once an incident is mitigated and you need help compiling the post-incident review quickly.",
                tags: ["incident", "postmortem", "learning"],
                standard: `Draft a blameless incident report.

Incident details:
- Title / summary: [describe]
- Impacted customers / metrics: [numbers]
- Start + end time: [timestamps]
- Detection: [how it was detected]
- Mitigation taken: [actions]
- Root cause clues: [logs, diffs]
- Follow-up owners known so far: [list]

Report should include:
1. Executive summary for stakeholders.
2. Detailed timeline with detection, response, mitigation.
3. Root cause analysis (5 whys or similar) with contributing factors.
4. Preventative actions grouped by priority.
5. Lessons learned and open questions.

Return markdown suitable for internal knowledge base.`,
                chatgpt: `/ROLE: Incident Commander & Postmortem Facilitator
/TASK: Write a blameless incident review for [incident summary].
/FORMAT: Executive summary + Timeline table + Root cause + Action register
/CONTEXT: Impact=[describe]; Timeline=[start/end]; Detection=[describe]; Mitigation=[actions]; Evidence=[logs/diffs]
/QUALITY BAR: Clear enough for leadership and engineering to align on fixes.
/ASK: If data is missing, pose clarifying questions before concluding.

/STEP-BY-STEP — reconstruct the timeline chronologically.
/CONTEXT STACK — cover business impact, technical failure, and process gaps.
/CHECKLIST — produce follow-up actions with owners and due dates.

Return sections: Summary, Timeline, Root Cause, Follow-up Actions, Lessons Learned.`,
            },
        ],
    },
];

export const ENGINEERING_TEMPLATES_FLAT: EngineeringTemplate[] = ENGINEERING_TEMPLATE_CATEGORIES.flatMap((category) => category.templates);
