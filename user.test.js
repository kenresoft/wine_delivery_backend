// index.js
const { test } = require('jest');
function add(a, b) {
    return a + b;
}

// user.test.js
test('adds numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
});