import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gappedInput } from "../tests/regressions/gapped-grid.fixture";
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver";
const modulePath = process.argv[2]
	? resolve(process.argv[2])
	: resolve(import.meta.dirname, "../lib/index.ts");
const { DogboneAutorouter } = await import(pathToFileURL(modulePath).href);
const cases: any[] = [];
for (const gap of [1.6, 2.4, 3.2])
	for (let turns = 0; turns < 4; turns++)
		for (const [sx, sy] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1],
		]) {
			const input = structuredClone(gappedInput);
			for (const o of input.obstacles) if (o.center.x < 0) o.center.x = -gap;
			for (const p of input.traces[0].route) {
				p.x *= sx;
				p.y *= sy;
			}
			const rotate = (p: any) => {
				for (let i = 0; i < turns; i++) {
					const x = p.x;
					p.x = -p.y;
					p.y = x;
				}
			};
			for (const o of input.obstacles) rotate(o.center);
			for (const c of input.connections)
				for (const p of c.pointsToConnect) rotate(p);
			for (const t of input.traces) for (const p of t.route) rotate(p);
			input.bounds = { minX: -6, maxX: 6, minY: -6, maxY: 6 };
			cases.push({ id: `gap${gap}-rot${turns * 90}-block${sx},${sy}`, input });
		}

const report: any = {
	scope:
		"48 gapped-grid local dogbone cases; not the bus-lanes 11-case suite or whole board",
	sourceRevision: process.env.BENCHMARK_SOURCE_SHA ?? "local",
	repetitions: 10,
	cases: [],
};
for (const sample of cases) {
	let seconds = 0,
		success = false,
		error: any;
	for (let repeat = 0; repeat < 10; repeat++) {
		const input = structuredClone(sample.input),
			before = JSON.stringify(input),
			at = performance.now();
		let output: any;
		try {
			output = new DogboneAutorouter({
				input,
				fanoutRoutingLayers: ["bottom"],
			}).solveSync();
			seconds += (performance.now() - at) / 1000;
		} catch (e) {
			seconds += (performance.now() - at) / 1000;
			error = String(e);
			success = false;
			continue;
		}
		if (before !== JSON.stringify(input)) throw Error("Input mutation");
		const foreign = input.traces[0].route,
			view = {
				...input,
				connections: [
					...input.connections,
					{ name: "foreign", pointsToConnect: [foreign[0], foreign.at(-1)] },
				],
			};
		const drc = validateRoutedCopperDrc({
			inputSrj: view,
			routedSrj: { ...view, traces: [...input.traces, ...output] },
			clearance: 0.1,
			allowBlindAndBuriedVias: false,
		});
		success = drc.valid;
		if (!success) error = JSON.stringify(drc.issues);
	}
	report.cases.push({
		id: sample.id,
		success,
		meanSeconds: seconds / 10,
		...(error ? { error } : {}),
	});
}
report.passed = report.cases.filter((r: any) => r.success).length;
report.total = cases.length;
report.meanSecondsPerCase =
	report.cases.reduce((s: number, r: any) => s + r.meanSeconds, 0) /
	cases.length;
writeFileSync(
	process.argv[3] ?? "gapped-benchmark.json",
	JSON.stringify(report, null, 2) + "\n",
);
console.log(
	JSON.stringify({
		passed: report.passed,
		total: report.total,
		meanSecondsPerCase: report.meanSecondsPerCase,
	}),
);
if (
	process.env.REQUIRE_ALL_GAPPED_CASES === "1" &&
	report.passed !== report.total
)
	process.exitCode = 1;
