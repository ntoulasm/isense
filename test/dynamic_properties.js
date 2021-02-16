let x = {
    a: 2
};

let y = x;
x.b = {};
y.b.b = {};
x.b.b.c = 2;
y;