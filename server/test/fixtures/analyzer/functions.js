function add(a, b) {
    return a + b;
}

let sum = add(1, 2);
//  ^hover
//        ^hover
//        ^def
let greeting = add('hello', ' world');
//  ^hover
//             ^hover

const multiply = (x, y) => x * y;
let product = multiply(3, 4);
//  ^hover
//            ^hover

function greet(name = 'Guest') {
    return 'Hello ' + name;
}

  greet();
//^hover
  greet('Marios');
//^hover
