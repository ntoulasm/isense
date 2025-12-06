const Stack = {};

Stack.create = function () {
	const stack = {};
	const elements = [];

	stack.push = function (element) {
		elements.push(element);
	};

	stack.isEmpty = function () {
		return elements.length === 0;
	};

	stack.pop = function () {
		console.assert(!stack.isEmpty());
		return elements.pop();
	};

	stack.top = function () {
		console.assert(!stack.isEmpty());
		return elements[elements.length - 1];
	};

	stack.getElements = () => elements;

	return stack;
};

module.exports = Stack;
