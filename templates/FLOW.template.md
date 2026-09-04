# Flow — {{flow.name}} (`{{flow.id}}`)

> Generated from `.codeatlas/flows.json` — do not edit manually.
> Last generated: {{generated_at}}

## Description

> {{flow.description}}

**Trigger:** `{{flow.trigger}}`  
**Confidence:** `{{flow.confidence}}`

## Involved Entities

**Features:**
{{#each flow.involved_features}}
- `{{this}}`
{{/each}}

**Systems:**
{{#each flow.involved_systems}}
- `{{this}}`
{{/each}}

**Files:**
{{#each flow.involved_files}}
- `{{this}}`
{{/each}}

## External Systems

{{#each flow.external_systems}}
- {{this}}
{{/each}}

## Steps

| Order | Description | File/System | Feature/System | Action |
|-------|-------------|-------------|----------------|--------|
| {{step.order}} | {{step.description}} | `{{step.file}}` | `{{step.feature}}` | {{step.action}} |

### Detailed Steps

{{#each flow.steps}}
#### Step {{order}} — {{description}}
- **File/System:** `{{file}}`
- **Feature/System:** `{{feature}}`
- **Action:** `{{action}}`
{{#if preconditions}}
- **Preconditions:**
{{#each preconditions}}
  - {{this}}
{{/each}}
{{/if}}
{{#if outcomes}}
- **Outcomes:**
{{#each outcomes}}
  - {{this}}
{{/each}}
{{/if}}
{{#if branches}}
- **Branches:**
{{#each branches}}
  - `{{label}}` — {{description}}{{#if next_step_order}} (jump to step {{next_step_order}}){{/if}}
{{/each}}
{{/if}}
{{#if evidence}}
- **Evidence:**
{{#each evidence}}
  - `{{this.type}}` — {{this.description}} (file: `{{this.file}}`, symbol: {{this.symbol}})
{{/each}}
{{/if}}
{{/each}}

## Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    {{#each flow.steps}}
    participant step{{order}} as Step {{order}}: {{description}}
    {{/each}}
    {{#each flow.steps}}
    {{#if @next}}
    step{{order}}->>step{{@next.order}}: proceed
    {{/if}}
    {{/each}}
```

> Mermaid is auto-generated from flow steps; refine by editing `.codeatlas/flows.json`.

## Notes

{{#each flow.notes}}
- {{this}}
{{/each}}

## How to Use This File

- **For agents (flow mode):** Trace steps, preconditions, outcomes, and branches to understand success and failure paths.
- **For humans:** Read top-to-bottom as "what happens when the user does X."
- **For sync:** If a step changes, update the affected step and re-validate confidence.

## Source

- `.codeatlas/flows.json` validated against `schemas/flow.schema.json`
