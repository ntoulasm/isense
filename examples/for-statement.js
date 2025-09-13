// For statement
let b = [], c = {}, e;
for (let i = 0; i < n; ++i) {
    b[i] = i * n;
    c["x" + i] = b[i];
}
c.x2 = 2;
/*
let i = 10;

for(i = 0; i < 100; ++i) {
    i = 100; 
}

i;

// For-of statement

let global = 10;

for(const b of a) {
    global = 1000;
}

// For-in statement

for(const b in {}) {
    global = "hello";
}

// Complex

let g;

for(;;) {
    g = {a: 5, b: 200};
    if(a) {
        g = {a: 2};
    }
}

g;*/