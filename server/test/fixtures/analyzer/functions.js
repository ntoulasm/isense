function add(a, b) {
    return a + b;
}

let sum = add(1, 2);
let greeting = add('hello', ' world');

const multiply = (x, y) => x * y;
let product = multiply(3, 4);

function greet(name = 'Guest') {
    return 'Hello ' + name;
}

greet();
greet('Marios');
