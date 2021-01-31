function add(a, b) {
    return a + b;
}

// function call(a) {
//     a();
// }

// function arithmOp(a, b) {
//     return a - b;
// }

// function getX(a) {
//     return a.x;
// }

// function getProperty(a, b) {
//     return a[b];
// }

function inferFromAssignments(a) {
    let x = a;
    // x = 2;
    {
        let y = x + 5;
    }
}

function foo(a) {
    function foo2(b) {
        return b + 2;
    }
    return foo2(a);
}

function f(a, b) {
	let x = b;
	a = x;
	return a + b;
}

let x = a;
x;
