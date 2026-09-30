/**
 * The k largest items by `score`, highest first, in O(n log k) time and O(k)
 * memory: a size-k min-heap keeps the best k seen so far, and each new item
 * only has to beat the heap's smallest. Ties keep the item seen first.
 */
const topK = (items, k, score = (item) => item.score) => {
	if (k <= 0) return [];
	const heap = []; // min-heap of { item, s, order }

	const less = (a, b) => a.s < b.s || (a.s === b.s && a.order > b.order);
	const swap = (i, j) => ([heap[i], heap[j]] = [heap[j], heap[i]]);
	const up = (i) => {
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (!less(heap[i], heap[parent])) break;
			swap(i, parent);
			i = parent;
		}
	};
	const down = (i) => {
		for (;;) {
			const l = 2 * i + 1;
			const r = l + 1;
			let smallest = i;
			if (l < heap.length && less(heap[l], heap[smallest])) smallest = l;
			if (r < heap.length && less(heap[r], heap[smallest])) smallest = r;
			if (smallest === i) return;
			swap(i, smallest);
			i = smallest;
		}
	};

	items.forEach((item, order) => {
		const node = { item, s: score(item), order };
		if (heap.length < k) {
			heap.push(node);
			up(heap.length - 1);
		} else if (less(heap[0], node)) {
			heap[0] = node;
			down(0);
		}
	});

	return heap.sort((a, b) => (less(a, b) ? 1 : less(b, a) ? -1 : 0)).map((node) => node.item);
};

module.exports = { topK };
