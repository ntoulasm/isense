const Stack = require('../../server/src/utility/stack');

describe('Stack Module', () => {
	let stack;

	beforeEach(() => {
		stack = Stack.create();
	});

	describe('Stack.create', () => {
		it('should create an empty stack', () => {
			// Act
			const newStack = Stack.create();

			// Assert
			expect(newStack.push).toBeInstanceOf(Function);
			expect(newStack.pop).toBeInstanceOf(Function);
			expect(newStack.top).toBeInstanceOf(Function);
			expect(newStack.isEmpty).toBeInstanceOf(Function);
			expect(newStack.getElements).toBeInstanceOf(Function);
		});
	});

	describe('push operation', () => {
		it('should add elements to the stack', () => {
			// Act
			stack.push('first');
			stack.push('second');

			// Assert
			expect(stack.getElements()).toHaveLength(2);
			expect(stack.isEmpty()).toBe(false);
		});

		it('should handle null and undefined values', () => {
			// Act
			stack.push(null);
			stack.push(undefined);

			// Assert
			expect(stack.getElements()).toHaveLength(2);
		});

		it('should handle different data types', () => {
			// Act
			stack.push(1);
			stack.push('string');
			stack.push({});
			stack.push([]);

			// Assert
			expect(stack.getElements()).toHaveLength(4);
		});
	});

	describe('pop operation', () => {
		it('should return the last pushed element', () => {
			// Arrange
			stack.push('first');
			stack.push('second');

			// Act
			const result = stack.pop();

			// Assert
			expect(result).toBe('second');
			expect(stack.getElements()).toHaveLength(1);
		});

		it('should maintain LIFO order', () => {
			// Arrange
			stack.push('first');
			stack.push('second');
			stack.push('third');

			// Act & Assert
			expect(stack.pop()).toBe('third');
			expect(stack.pop()).toBe('second');
			expect(stack.pop()).toBe('first');
		});

		it('should handle empty stack with console.assert', () => {
			// Arrange - Mock console.assert to capture calls
			const originalAssert = console.assert;
			let assertCalled = false;
			console.assert = (condition, ...args) => {
				if (!condition) assertCalled = true;
			};

			// Act
			try {
				stack.pop(); // This should trigger console.assert
			} finally {
				console.assert = originalAssert;
			}

			// Assert
			expect(assertCalled).toBe(true);
		});
	});

	describe('top operation', () => {
		it('should return the top element without removing it', () => {
			// Arrange
			stack.push('first');
			stack.push('second');

			// Act
			const result = stack.top();

			// Assert
			expect(result).toBe('second');
			expect(stack.getElements()).toHaveLength(2); // Should not remove element
		});

		it('should not affect stack state', () => {
			// Arrange
			stack.push('element');
			const originalLength = stack.getElements().length;

			// Act
			stack.top();

			// Assert
			expect(stack.getElements()).toHaveLength(originalLength);
		});

		it('should handle empty stack with console.assert', () => {
			// Arrange - Mock console.assert to capture calls
			const originalAssert = console.assert;
			let assertCalled = false;
			console.assert = (condition, ...args) => {
				if (!condition) assertCalled = true;
			};

			// Act
			try {
				stack.top(); // This should trigger console.assert
			} finally {
				console.assert = originalAssert;
			}

			// Assert
			expect(assertCalled).toBe(true);
		});
	});

	describe('isEmpty operation', () => {
		it('should return true for new stack', () => {
			// Act & Assert
			expect(stack.isEmpty()).toBe(true);
		});

		it('should return false when stack has elements', () => {
			// Arrange
			stack.push('element');

			// Act & Assert
			expect(stack.isEmpty()).toBe(false);
		});

		it('should return true after all elements are popped', () => {
			// Arrange
			stack.push('first');
			stack.push('second');

			// Act
			stack.pop();
			stack.pop();

			// Assert
			expect(stack.isEmpty()).toBe(true);
		});
	});

	describe('getElements operation', () => {
		it('should return empty array for empty stack', () => {
			// Act & Assert
			expect(stack.getElements()).toEqual([]);
		});

		it('should track elements correctly as they are added', () => {
			// Act & Assert
			expect(stack.getElements()).toHaveLength(0);

			stack.push('first');
			expect(stack.getElements()).toHaveLength(1);

			stack.push('second');
			expect(stack.getElements()).toHaveLength(2);

			stack.push('third');
			expect(stack.getElements()).toHaveLength(3);
		});

		it('should track elements correctly as they are removed', () => {
			// Arrange
			stack.push('first');
			stack.push('second');
			stack.push('third');
			expect(stack.getElements()).toHaveLength(3);

			// Act & Assert
			stack.pop();
			expect(stack.getElements()).toHaveLength(2);

			stack.pop();
			expect(stack.getElements()).toHaveLength(1);

			stack.pop();
			expect(stack.getElements()).toHaveLength(0);
		});
	});

	describe('complex operations', () => {
		it('should handle alternating push and pop operations', () => {
			// Act
			stack.push('a');
			expect(stack.pop()).toBe('a');

			stack.push('b');
			stack.push('c');
			expect(stack.pop()).toBe('c');

			stack.push('d');
			expect(stack.getElements()).toHaveLength(2);
			expect(stack.top()).toBe('d');
		});

		it('should handle many operations efficiently', () => {
			// Act - Push many items (reduced from 1000 to 100 for faster testing)
			for (let i = 0; i < 100; i++) {
				stack.push(i);
			}

			// Assert
			expect(stack.getElements()).toHaveLength(100);

			// Act - Pop all items
			const poppedItems = [];
			for (let i = 0; i < 100; i++) {
				poppedItems.push(stack.pop());
			}

			// Assert
			expect(poppedItems).toHaveLength(100);
			expect(poppedItems[0]).toBe(99); // Last pushed, first popped
			expect(poppedItems[99]).toBe(0); // First pushed, last popped
			expect(stack.isEmpty()).toBe(true);
		});

		it('should maintain integrity after multiple top operations', () => {
			// Arrange
			stack.push('test');

			// Act
			for (let i = 0; i < 10; i++) {
				stack.top();
			}

			// Assert
			expect(stack.getElements()).toHaveLength(1);
			expect(stack.top()).toBe('test');
		});
	});

	describe('edge cases', () => {
		it('should handle storing complex objects', () => {
			// Arrange
			const complexObject = {
				nested: { property: 'value' },
				array: [1, 2, 3],
				func: () => 'test',
			};

			// Act
			stack.push(complexObject);

			// Assert
			expect(stack.top()).toBe(complexObject);
			expect(stack.pop()).toBe(complexObject);
		});

		it('should handle reference equality', () => {
			// Arrange
			const obj1 = { id: 1 };
			const obj2 = { id: 2 };

			// Act
			stack.push(obj1);
			stack.push(obj2);

			// Assert
			expect(stack.pop()).toBe(obj2);
			expect(stack.pop()).toBe(obj1);
		});
	});
});
