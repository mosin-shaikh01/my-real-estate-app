// TS 6 raises TS2882 for side-effect imports of packages that ship only CSS and
// carry no type declarations. Fontsource is exactly that: `import
// '@fontsource-variable/inter'` resolves to a stylesheet with nothing to type.
// Declaring the module is the intended escape hatch.
declare module '@fontsource-variable/inter'
