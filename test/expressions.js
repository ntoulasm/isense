const a = 2;
const b = 5;
const c = a + b;

const d = "d";
const e = "e";
let w = d + e;

let f = true;
let g = false;
let h = f + g;
f = null;
h = f + f;
f = undefined;
h = f + f;

f = function () {};

let x = 2;
let y = "";

let z = x + y;
z = 2 + true;
z = 2 + false;
z = 2 + [];
z = 2 + {};

x = {a: 2};
z = x + 2;
z = x + "aaa";
z = x + true;
z = x + false;
z = x + [];
z = x + null;
z = x + undefined;
