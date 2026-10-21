import esbuild from "esbuild";
const prod = process.argv[2] !== "watch";
const ctx = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view", "@codemirror/language"],
	format: "cjs",
	target: "es2020",
	sourcemap: prod ? false : "inline",
	outfile: "main.js",
	logLevel: "info",
});
if (prod) { await ctx.rebuild(); await ctx.dispose(); } else { await ctx.watch(); }
