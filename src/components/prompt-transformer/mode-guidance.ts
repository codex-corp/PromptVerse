import { ModeAnalyticsState, ModeDefinition, ModeSuggestion } from "./types";

export const MODE_DEFINITIONS: ModeDefinition[] = [
    { id: "/STEP-BY-STEP", label: "Sequential walkthrough", description: "Great for debugging or intricate logic flows.", category: "core" },
    { id: "/CHAIN OF THOUGHT", label: "Reasoning trail", description: "Use for architecture, trade-offs, or algorithm design discussions.", category: "core" },
    { id: "/FIRST PRINCIPLES", label: "Rebuild from fundamentals", description: "Ideal when legacy assumptions need to be challenged.", category: "core" },
    { id: "/DELIBERATE THINKING", label: "Slow comparison", description: "Encourage option analysis and risk surfacing.", category: "core" },
    { id: "/CHECKLIST", label: "Actionable list", description: "Transforms outcomes into executable tasks.", category: "organization" },
    { id: "/SCHEMA", label: "Structured model", description: "Perfect for API contracts, data models, or diagrams.", category: "organization" },
    { id: "/CONTEXT STACK", label: "Layered context", description: "Keeps business, infra, and UX constraints tied together.", category: "organization" },
    { id: "/BEGIN WITH / END WITH", label: "Framed output", description: "Guarantees strong intros and conclusions.", category: "organization" },
    { id: "/ACT AS", label: "Persona alignment", description: "Locks the assistant into a domain-specific role.", category: "practical" },
    { id: "/DEV MODE", label: "Engineer focus", description: "Requests terse, logic-first responses.", category: "practical" },
    { id: "/PM MODE", label: "Planning lens", description: "Highlights milestones, dependencies, and ownership.", category: "practical" },
    { id: "/CHAIN OF THOUGHT + PITFALLS", label: "Risks + reasoning", description: "Excellent for design docs and risk reviews.", category: "practical" }
];

const MODE_KEYWORDS: Array<{ keywords: RegExp; modeId: string; reason: string }> = [
    { keywords: /(debug|bug|trace|investigat|root cause|issue)/i, modeId: "/STEP-BY-STEP", reason: "Spotted debugging language; a sequential trace will help." },
    { keywords: /(architect|design|trade[- ]?off|strategy|compare|versus|vs\.?)/i, modeId: "/CHAIN OF THOUGHT", reason: "Design/architecture language benefits from transparent reasoning." },
    { keywords: /(legacy|rewrite|clean slate|fundamental|ground up)/i, modeId: "/FIRST PRINCIPLES", reason: "Request hints at rethinking from scratch." },
    { keywords: /(risk|mitigat|uncertain|option|choice)/i, modeId: "/DELIBERATE THINKING", reason: "Risk or trade-off focus pairs well with deliberate comparison." },
    { keywords: /(plan|roadmap|milestone|project|release|sprint|checklist)/i, modeId: "/CHECKLIST", reason: "Planning cues detected; checklist keeps execution tight." },
    { keywords: /(schema|api|contract|model|json|database|table|diagram)/i, modeId: "/SCHEMA", reason: "Structured data/design keywords detected." },
    { keywords: /(multi-layer|business|infra|ux|stakeholder|impact)/i, modeId: "/CONTEXT STACK", reason: "Multi-domain cues found; context stack keeps alignment." },
    { keywords: /(summary|conclusion|next steps)/i, modeId: "/BEGIN WITH / END WITH", reason: "Summary-oriented phrasing benefits from framed output." },
    { keywords: /(persona|act as|role play|specialist)/i, modeId: "/ACT AS", reason: "Request implies a persona; ACT AS ensures alignment." },
    { keywords: /(code|implementation|engineering|refactor|pull request|migration)/i, modeId: "/DEV MODE", reason: "Hands-on build language calls for engineer-focused tone." },
    { keywords: /(project manager|timeline|dependencies|cross-functional)/i, modeId: "/PM MODE", reason: "Planning/coordination cues benefit from PM framing." },
    { keywords: /(risk analysis|pitfall|gotcha|regression|edge case)/i, modeId: "/CHAIN OF THOUGHT + PITFALLS", reason: "Risk-focused language pairs well with reasoning plus pitfalls." }
];

export const findModeDefinition = (id: string) => MODE_DEFINITIONS.find((mode) => mode.id === id);

export const deriveModeSuggestions = (input: string): ModeSuggestion[] => {
    if (!input.trim()) {
        return [];
    }

    const matches: ModeSuggestion[] = [];
    MODE_KEYWORDS.forEach(({ keywords, modeId, reason }) => {
        if (keywords.test(input) && !matches.some((item) => item.id === modeId)) {
            const definition = findModeDefinition(modeId);
            if (definition) {
                matches.push({ ...definition, reason });
            }
        }
    });

    return matches.slice(0, 4);
};

export const MODE_ANALYTICS_STORAGE_KEY = "promptverse-mode-analytics";

export const loadAnalyticsFromStorage = (): ModeAnalyticsState => {
    if (typeof window === "undefined") {
        return { totalTransforms: 0, modeCounts: {}, lastModes: [] };
    }

    try {
        const stored = window.localStorage.getItem(MODE_ANALYTICS_STORAGE_KEY);
        if (!stored) {
            return { totalTransforms: 0, modeCounts: {}, lastModes: [] };
        }
        const parsed = JSON.parse(stored);
        return {
            totalTransforms: parsed.totalTransforms || 0,
            modeCounts: parsed.modeCounts || {},
            lastModes: parsed.lastModes || [],
        };
    } catch (error) {
        console.error("Failed to load mode analytics", error);
        return { totalTransforms: 0, modeCounts: {}, lastModes: [] };
    }
};

export const persistAnalytics = (state: ModeAnalyticsState) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(MODE_ANALYTICS_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Failed to persist mode analytics", error);
    }
};
