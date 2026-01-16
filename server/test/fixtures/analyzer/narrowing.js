let x = 1;
if (typeof x === 'number') {
    let y = x + 10;
}

let z;
if (Math.random() > 0.5) {
    z = 'string';
} else {
    z = 123;
}
// z is string | number here
let finalZ = z;

function check(val) {
    if (val) {
        return val;
    }
    return 'default';
}
