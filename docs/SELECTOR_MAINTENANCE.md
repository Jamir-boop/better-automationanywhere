# Selector Maintenance

Use this when adding, updating, deprecating, or deleting Automation Anywhere DOM selectors.

## Source Of Truth

External Automation Anywhere selectors live in:

- `src/ts/automation-anywhere-selectors.ts`

Do not add raw Automation Anywhere selectors directly in runtime files. Add a named selector const in the registry, then import it where needed.

Extension-owned selectors can stay local:

- sidepanel ids/classes/data attributes
- generated extension UI classes
- internal test-only selectors

## Selector Status

Use these values in `AUTOMATION_ANYWHERE_SELECTOR_CHECKS`:

- `active`: current selector, keep validating.
- `watch`: works now, but brittle or fallback-based.
- `deprecated`: retained only for compatibility.
- `remove-candidate`: believed unused, pending manual validation.

## Update Selector

1. Edit selector const in `src/ts/automation-anywhere-selectors.ts`.
2. Keep existing `AUTOMATION_ANYWHERE_SELECTOR_CHECKS` entry id.
3. If old selector must remain as fallback, combine selectors with `,` and set `status: 'watch'`.
4. Update `notes` if reason is not obvious.
5. Run:

```bash
rtk corepack pnpm test:style-doctor
rtk corepack pnpm compile
```

## Add Selector

1. Add named const:

```ts
export const NEW_FEATURE_SELECTOR = '.automation-anywhere-selector';
```

2. Import and use const in runtime code.
3. Add Doctor check only if selector should be manually validated:

```ts
{
	id: 'new-feature-selector',
	view: 'taskbot-editor',
	group: 'taskbot-editor',
	label: 'New feature selector',
	feature: 'Feature name',
	selector: NEW_FEATURE_SELECTOR,
	source: 'src/ts/file.ts',
	severity: 'optional',
	status: 'active',
}
```

4. Add checklist row in `docs/FEATURE_CHECKLIST.md`.
5. Run:

```bash
rtk corepack pnpm test:style-doctor
rtk corepack pnpm compile
```

## Deprecate Selector

1. Search all references:

```bash
rtk rg "OLD_SELECTOR|old-css-fragment"
```

2. If still needed as fallback, keep selector and set check `status: 'deprecated'` or `status: 'watch'`.
3. Add `notes` explaining why it remains.
4. Update `docs/FEATURE_CHECKLIST.md` status and delete condition.
5. Run:

```bash
rtk corepack pnpm test:style-doctor
rtk corepack pnpm compile
```

## Remove Selector

1. Confirm manual checklist row has dated validation note.
2. Search references:

```bash
rtk rg "OLD_SELECTOR|old-css-fragment"
```

3. Replace or delete all callers.
4. Delete selector const.
5. Delete matching `AUTOMATION_ANYWHERE_SELECTOR_CHECKS` entry.
6. Delete or update checklist row in `docs/FEATURE_CHECKLIST.md`.
7. Run full maintenance:

```bash
rtk corepack pnpm check:maintenance
```

## Known Exception

Palette toggle selector also exists inline in `src/ts/automation-anywhere.ts`.

Reason: current test loader imports that module through a `data:` URL, so relative selector-registry imports fail there.

If changing palette toggle selector, update both:

- `src/ts/automation-anywhere-selectors.ts`
- `src/ts/automation-anywhere.ts`

## Doctor Rules

- Required selector missing -> fail.
- Optional selector missing -> warn.
- Transient selector missing -> skip.
- Invalid selector query -> fail and debug warning.

Keep Doctor checks focused on external Automation Anywhere DOM. Do not add sidepanel selectors there.
