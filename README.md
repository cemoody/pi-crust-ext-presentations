# @cemoody/pi-crust-ext-presentations

Slide-deck generation and template-pack discovery for pi-crust.

**Provides:** the `show_presentation` and `list_presentation_templates` tools + template-pack discovery + a `builtin` template pack

## Install

```bash
npm install @cemoody/pi-crust-ext-presentations
```

Or use [`pi-crust-full`](https://www.npmjs.com/package/pi-crust-full), which installs this together with [`pi-crust`](https://www.npmjs.com/package/pi-crust) and the other official extensions:

```bash
npx pi-crust-full
```

## What it is

This is an official extension for [pi-crust](https://github.com/cemoody/pi-crust) — the self-hosted web control plane for [pi.dev](https://pi.dev/) coding-agent sessions. Pi-crust discovers any installed package whose `package.json` carries a `piRemoteControl` (or `piCrust`) field, so dropping this package into `node_modules` is enough — no configuration required.

See the [pi-crust extensions docs](https://github.com/cemoody/pi-crust/tree/main/extensions) for the extension API and worked examples.

## License

MIT.
