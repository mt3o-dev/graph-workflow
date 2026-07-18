/**
 * Minimal, dependency-free markdown → HTML for KB answer bodies (trusted
 * local content — the markdown files under the kb directory, never user
 * input). Supports the subset the knowledge base actually uses: headings,
 * paragraphs, bold, inline code, fenced code blocks and unordered lists.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
	let html = escapeHtml(text);
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	return html;
}

export function renderMarkdown(source: string): string {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let list: string[] = [];
	let codeFence: string[] | null = null;

	const flushParagraph = (): void => {
		if (paragraph.length > 0) {
			blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
			paragraph = [];
		}
	};
	const flushList = (): void => {
		if (list.length > 0) {
			blocks.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
			list = [];
		}
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();

		if (line.startsWith('```')) {
			if (codeFence) {
				blocks.push(`<pre><code>${escapeHtml(codeFence.join('\n'))}</code></pre>`);
				codeFence = null;
			} else {
				flushParagraph();
				flushList();
				codeFence = [];
			}
			continue;
		}
		if (codeFence) {
			codeFence.push(rawLine);
			continue;
		}

		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = heading[1]!.length;
			blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
			continue;
		}

		const listItem = /^[-*]\s+(.*)$/.exec(line);
		if (listItem) {
			flushParagraph();
			list.push(listItem[1]!);
			continue;
		}

		if (line.trim() === '') {
			flushParagraph();
			flushList();
			continue;
		}

		flushList();
		paragraph.push(line.trim());
	}
	flushParagraph();
	flushList();
	if (codeFence) blocks.push(`<pre><code>${escapeHtml(codeFence.join('\n'))}</code></pre>`);

	return blocks.join('\n');
}
