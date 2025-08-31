export default function Tips() {
	return (
		<div className="bg-neutral-900/40 rounded-2xl p-4 ring-1 ring-neutral-800 shadow mt-4">
			<h3 className="font-semibold mb-2">Tips</h3>
			<ul className="list-disc pl-5 text-neutral-300 space-y-1 text-sm">
				<li>Each extra character multiplies work by <b>×58</b>. 5 letters may take minutes; 6 can take hours; 7+ can take days/weeks.</li>
				<li>You can run more threads for higher throughput, but your device may get hot. Stay on power.</li>
				<li>Only Base58 characters are valid (no 0, O, I, l, etc.). Case matters.</li>
				<li>Never share your seed. Save it offline securely.</li>
			</ul>
		</div>
	);
} 