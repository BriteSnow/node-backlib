

/** Promise a message and return the trimmed entered value */
export async function prompt(message: string) {
	process.stdout.write(`\n${message}: `);
	return new Promise(function (resolve, reject) {
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', function (text) {
			process.stdin.pause();
			resolve(text.toString().trim());
		});
	});
}