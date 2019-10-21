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

x = () => {};
y = function() {};
z = x + y;

/* Unary + */
z = +2;
z = +"2";
z = +"";
z = +"aaa";
z = +true;
z = +false;
z = +[];
z = +{};
z = +(function() {});
z = +(() => {});
z = +null;
z = +undefined;

/* Unary - */
z = -2;
z = -"2";
z = -"";
z = -"aaa";
z = -true;
z = -false;
z = -[];
z = -{};
z = -(function() {});
z = -(() => {});
z = -null;
z = -undefined;

/* Prefix ++ */
x = 2;
z = ++x;

/* Prefix -- */
z = --x;

z = void 2;

z = typeof 2;
z = typeof "aaa";
z = typeof true;
z = typeof false;
z = typeof [];
z = typeof {};
z = typeof (function() {});
z = typeof (() => {});
z = typeof (class {});
z = typeof null;
z = typeof undefined;
class p {};
z = typeof new p();
