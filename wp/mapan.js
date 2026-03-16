(function () {
    const n = document.createElement("link").relList;
    if (n && n.supports && n.supports("modulepreload")) return;
    for (const m of document.querySelectorAll('link[rel="modulepreload"]')) c(m);
    new MutationObserver((m) => {
        for (const R of m)
            if (R.type === "childList")
                for (const F of R.addedNodes) F.tagName === "LINK" && F.rel === "modulepreload" && c(F);
    }).observe(document, { childList: !0, subtree: !0 });
    function r(m) {
        const R = {};
        return (
            m.integrity && (R.integrity = m.integrity),
            m.referrerpolicy && (R.referrerPolicy = m.referrerpolicy),
            m.crossorigin === "use-credentials"
                ? (R.credentials = "include")
                : m.crossorigin === "anonymous"
                  ? (R.credentials = "omit")
                  : (R.credentials = "same-origin"),
            R
        );
    }
    function c(m) {
        if (m.ep) return;
        m.ep = !0;
        const R = r(m);
        fetch(m.href, R);
    }
})();
const $e = [
        "#D9E5EB",
        "#B5C0C6",
        "#557484",
        "#2C697F",
        "#034053",
        "#000000",
        "#FECD1A",
        "#EFED9B",
        "#F7AA42",
        "#803717",
        "#EF7F00",
        "#FABE5D",
        "#D8C262",
        "#C2AB60",
        "#C67615",
        "#7E7948",
        "#F6AD6E",
        "#FDD48F",
        "#91816D",
        "#544429",
        "#EB6A27",
        "#F29B81",
        "#C73636",
        "#955D40",
        "#6B4833",
        "#E85127",
        "#CB653C",
        "#A53722",
        "#BD6B44",
        "#D4011D",
        "#F19C99",
        "#C10121",
        "#EB6E81",
        "#B5007C",
        "#6D3F6E",
        "#6F195F",
        "#3E2A71",
        "#7C5D9F",
        "#2B195F",
        "#003483",
        "#655A9F",
        "#02315C",
        "#00579D",
        "#0092D2",
        "#012857",
        "#0262A7",
        "#003556",
        "#007FAC",
        "#00A5CF",
        "#00AEC6",
        "#047E9D",
        "#028D7A",
        "#3AB6B8",
        "#009B5A",
        "#368F2D",
        "#70BD95",
        "#47732D",
        "#039A47",
        "#628B2A",
        "#4E602C",
        "#A4C401",
        "#FCE90F",
        "#F0D500",
        "#AD9216",
        "#FBEB46",
        "#005A9A",
        "#E53257",
        "#F6AA24",
        "#C7C2B4",
        "#6E6168",
        "#3E2F36",
        "#D6855D",
        "#C7CDD1",
        "#C3A24E",
        "#282838",
        "#FFE7AB",
        "#E53527",
        "#86273D",
        "#76ACD5",
        "#00784F",
        "#7AB63E",
        "#C7D32D",
    ],
    Bn = typeof window < "u" ? window.location.search : "";
new URLSearchParams(Bn);
const Un = 0.5 * (Math.sqrt(3) - 1),
    Me = (3 - Math.sqrt(3)) / 6,
    Xn = 1 / 3,
    ie = 1 / 6,
    Vn = (Math.sqrt(5) - 1) / 4,
    qt = (5 - Math.sqrt(5)) / 20,
    $t = new Float32Array([
        1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0,
        -1, -1,
    ]),
    _t = new Float32Array([
        0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 1,
        0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1, 1, 1,
        0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, -1, 1, 1, 1,
        0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0,
    ]);
class Yn {
    constructor(n = Math.random) {
        const r = typeof n == "function" ? n : zn(n);
        (this.p = _n(r)), (this.perm = new Uint8Array(512)), (this.permMod12 = new Uint8Array(512));
        for (let c = 0; c < 512; c++) (this.perm[c] = this.p[c & 255]), (this.permMod12[c] = this.perm[c] % 12);
    }
    noise2D(n, r) {
        const c = this.permMod12,
            m = this.perm;
        let R = 0,
            F = 0,
            U = 0;
        const H = (n + r) * Un,
            J = Math.floor(n + H),
            L = Math.floor(r + H),
            yt = (J + L) * Me,
            vt = J - yt,
            St = L - yt,
            ot = n - vt,
            mt = r - St;
        let j, st;
        ot > mt ? ((j = 1), (st = 0)) : ((j = 0), (st = 1));
        const W = ot - j + Me,
            K = mt - st + Me,
            Q = ot - 1 + 2 * Me,
            it = mt - 1 + 2 * Me,
            M = J & 255,
            I = L & 255;
        let i = 0.5 - ot * ot - mt * mt;
        if (i >= 0) {
            const D = c[M + m[I]] * 3;
            (i *= i), (R = i * i * ($t[D] * ot + $t[D + 1] * mt));
        }
        let k = 0.5 - W * W - K * K;
        if (k >= 0) {
            const D = c[M + j + m[I + st]] * 3;
            (k *= k), (F = k * k * ($t[D] * W + $t[D + 1] * K));
        }
        let S = 0.5 - Q * Q - it * it;
        if (S >= 0) {
            const D = c[M + 1 + m[I + 1]] * 3;
            (S *= S), (U = S * S * ($t[D] * Q + $t[D + 1] * it));
        }
        return 70 * (R + F + U);
    }
    noise3D(n, r, c) {
        const m = this.permMod12,
            R = this.perm;
        let F, U, H, J;
        const L = (n + r + c) * Xn,
            yt = Math.floor(n + L),
            vt = Math.floor(r + L),
            St = Math.floor(c + L),
            ot = (yt + vt + St) * ie,
            mt = yt - ot,
            j = vt - ot,
            st = St - ot,
            W = n - mt,
            K = r - j,
            Q = c - st;
        let it, M, I, i, k, S;
        W >= K
            ? K >= Q
                ? ((it = 1), (M = 0), (I = 0), (i = 1), (k = 1), (S = 0))
                : W >= Q
                  ? ((it = 1), (M = 0), (I = 0), (i = 1), (k = 0), (S = 1))
                  : ((it = 0), (M = 0), (I = 1), (i = 1), (k = 0), (S = 1))
            : K < Q
              ? ((it = 0), (M = 0), (I = 1), (i = 0), (k = 1), (S = 1))
              : W < Q
                ? ((it = 0), (M = 1), (I = 0), (i = 0), (k = 1), (S = 1))
                : ((it = 0), (M = 1), (I = 0), (i = 1), (k = 1), (S = 0));
        const D = W - it + ie,
            nt = K - M + ie,
            Y = Q - I + ie,
            w = W - i + 2 * ie,
            X = K - k + 2 * ie,
            V = Q - S + 2 * ie,
            N = W - 1 + 3 * ie,
            T = K - 1 + 3 * ie,
            lt = Q - 1 + 3 * ie,
            dt = yt & 255,
            et = vt & 255,
            ft = St & 255;
        let xt = 0.6 - W * W - K * K - Q * Q;
        if (xt < 0) F = 0;
        else {
            const It = m[dt + R[et + R[ft]]] * 3;
            (xt *= xt), (F = xt * xt * ($t[It] * W + $t[It + 1] * K + $t[It + 2] * Q));
        }
        let rt = 0.6 - D * D - nt * nt - Y * Y;
        if (rt < 0) U = 0;
        else {
            const It = m[dt + it + R[et + M + R[ft + I]]] * 3;
            (rt *= rt), (U = rt * rt * ($t[It] * D + $t[It + 1] * nt + $t[It + 2] * Y));
        }
        let pt = 0.6 - w * w - X * X - V * V;
        if (pt < 0) H = 0;
        else {
            const It = m[dt + i + R[et + k + R[ft + S]]] * 3;
            (pt *= pt), (H = pt * pt * ($t[It] * w + $t[It + 1] * X + $t[It + 2] * V));
        }
        let At = 0.6 - N * N - T * T - lt * lt;
        if (At < 0) J = 0;
        else {
            const It = m[dt + 1 + R[et + 1 + R[ft + 1]]] * 3;
            (At *= At), (J = At * At * ($t[It] * N + $t[It + 1] * T + $t[It + 2] * lt));
        }
        return 32 * (F + U + H + J);
    }
    noise4D(n, r, c, m) {
        const R = this.perm;
        let F, U, H, J, L;
        const yt = (n + r + c + m) * Vn,
            vt = Math.floor(n + yt),
            St = Math.floor(r + yt),
            ot = Math.floor(c + yt),
            mt = Math.floor(m + yt),
            j = (vt + St + ot + mt) * qt,
            st = vt - j,
            W = St - j,
            K = ot - j,
            Q = mt - j,
            it = n - st,
            M = r - W,
            I = c - K,
            i = m - Q;
        let k = 0,
            S = 0,
            D = 0,
            nt = 0;
        it > M ? k++ : S++,
            it > I ? k++ : D++,
            it > i ? k++ : nt++,
            M > I ? S++ : D++,
            M > i ? S++ : nt++,
            I > i ? D++ : nt++;
        const Y = k >= 3 ? 1 : 0,
            w = S >= 3 ? 1 : 0,
            X = D >= 3 ? 1 : 0,
            V = nt >= 3 ? 1 : 0,
            N = k >= 2 ? 1 : 0,
            T = S >= 2 ? 1 : 0,
            lt = D >= 2 ? 1 : 0,
            dt = nt >= 2 ? 1 : 0,
            et = k >= 1 ? 1 : 0,
            ft = S >= 1 ? 1 : 0,
            xt = D >= 1 ? 1 : 0,
            rt = nt >= 1 ? 1 : 0,
            pt = it - Y + qt,
            At = M - w + qt,
            It = I - X + qt,
            Lt = i - V + qt,
            C = it - N + 2 * qt,
            P = M - T + 2 * qt,
            A = I - lt + 2 * qt,
            s = i - dt + 2 * qt,
            h = it - et + 3 * qt,
            o = M - ft + 3 * qt,
            l = I - xt + 3 * qt,
            a = i - rt + 3 * qt,
            p = it - 1 + 4 * qt,
            f = M - 1 + 4 * qt,
            y = I - 1 + 4 * qt,
            u = i - 1 + 4 * qt,
            v = vt & 255,
            _ = St & 255,
            g = ot & 255,
            b = mt & 255;
        let E = 0.6 - it * it - M * M - I * I - i * i;
        if (E < 0) F = 0;
        else {
            const O = (R[v + R[_ + R[g + R[b]]]] % 32) * 4;
            (E *= E), (F = E * E * (_t[O] * it + _t[O + 1] * M + _t[O + 2] * I + _t[O + 3] * i));
        }
        let z = 0.6 - pt * pt - At * At - It * It - Lt * Lt;
        if (z < 0) U = 0;
        else {
            const O = (R[v + Y + R[_ + w + R[g + X + R[b + V]]]] % 32) * 4;
            (z *= z), (U = z * z * (_t[O] * pt + _t[O + 1] * At + _t[O + 2] * It + _t[O + 3] * Lt));
        }
        let G = 0.6 - C * C - P * P - A * A - s * s;
        if (G < 0) H = 0;
        else {
            const O = (R[v + N + R[_ + T + R[g + lt + R[b + dt]]]] % 32) * 4;
            (G *= G), (H = G * G * (_t[O] * C + _t[O + 1] * P + _t[O + 2] * A + _t[O + 3] * s));
        }
        let $ = 0.6 - h * h - o * o - l * l - a * a;
        if ($ < 0) J = 0;
        else {
            const O = (R[v + et + R[_ + ft + R[g + xt + R[b + rt]]]] % 32) * 4;
            ($ *= $), (J = $ * $ * (_t[O] * h + _t[O + 1] * o + _t[O + 2] * l + _t[O + 3] * a));
        }
        let Z = 0.6 - p * p - f * f - y * y - u * u;
        if (Z < 0) L = 0;
        else {
            const O = (R[v + 1 + R[_ + 1 + R[g + 1 + R[b + 1]]]] % 32) * 4;
            (Z *= Z), (L = Z * Z * (_t[O] * p + _t[O + 1] * f + _t[O + 2] * y + _t[O + 3] * u));
        }
        return 27 * (F + U + H + J + L);
    }
}
function _n(e) {
    const n = new Uint8Array(256);
    for (let r = 0; r < 256; r++) n[r] = r;
    for (let r = 0; r < 255; r++) {
        const c = r + ~~(e() * (256 - r)),
            m = n[r];
        (n[r] = n[c]), (n[c] = m);
    }
    return n;
}
function zn(e) {
    let n = 0,
        r = 0,
        c = 0,
        m = 1;
    const R = $n();
    return (
        (n = R(" ")),
        (r = R(" ")),
        (c = R(" ")),
        (n -= R(e)),
        n < 0 && (n += 1),
        (r -= R(e)),
        r < 0 && (r += 1),
        (c -= R(e)),
        c < 0 && (c += 1),
        function () {
            const F = 2091639 * n + m * 23283064365386963e-26;
            return (n = r), (r = c), (c = F - (m = F | 0));
        }
    );
}
function $n() {
    let e = 4022871197;
    return function (n) {
        n = n.toString();
        for (let r = 0; r < n.length; r++) {
            e += n.charCodeAt(r);
            let c = 0.02519603282416938 * e;
            (e = c >>> 0), (c -= e), (c *= e), (e = c >>> 0), (c -= e), (e += c * 4294967296);
        }
        return (e >>> 0) * 23283064365386963e-26;
    };
}
const Wn = (e, n = 0, r = 1) => {
    const c = { hash: e, editionNumber: n, totalEditions: r, input: {} };
    return btoa(JSON.stringify(c).replace("==", ""));
};
let Fe = tokenData;
function qn() {}
setTimeout(qn, 0);
console.log(Fe.hash);
console.log(Wn(Fe.hash));
const Zn = function (e) {
    var n,
        r,
        c,
        m,
        R = (function (H) {
            for (var J = 0, L = 1779033703 ^ H.length; J < H.length; J++)
                L = ((L = Math.imul(L ^ H.charCodeAt(J), 3432918353)) << 13) | (L >>> 19);
            return function () {
                return (
                    (L = Math.imul((L = Math.imul(L ^ (L >>> 16), 2246822507)) ^ (L >>> 13), 3266489909)),
                    (L ^= L >>> 16) >>> 0
                );
            };
        })(e),
        F = {
            rand:
                ((n = R()),
                (r = R()),
                (c = R()),
                (m = R()),
                function () {
                    c |= 0;
                    var U = ((((n |= 0) + (r |= 0)) | 0) + (m |= 0)) | 0;
                    return (
                        (m = (m + 1) | 0),
                        (n = r ^ (r >>> 9)),
                        (r = (c + (c << 3)) | 0),
                        (c = ((c = (c << 21) | (c >>> 11)) + U) | 0),
                        (U >>> 0) / 4294967296
                    );
                }),
            randInt: function (U, H) {
                return U + Math.floor((H - U) * F.rand());
            },
        };
    return F;
};
class un {
    constructor(n = !1) {
        (this.useA = !1),
            (this.tk = Fe),
            (this.useNative = n),
            (this.prng = Zn(Fe.hash)),
            (this.simplex = new Yn(this.random()));
    }
    random() {
        return this.useNative ? Math.random() : this.prng.rand();
    }
    range(n, r) {
        return n + (r - n) * this.random();
    }
    int(n, r) {
        return Math.floor(n + (r - n + 1) * this.random());
    }
    bool(n) {
        return this.random() < n;
    }
    pick(n) {
        return n[this.int(0, n.length - 1)];
    }
    n2D(n, r) {
        return this.simplex.noise2D(n, r);
    }
    curl2D(n, r, c = 1) {
        const m = this.n2D(n, r + c),
            R = this.n2D(n, r - c),
            F = this.n2D(n + c, r),
            U = this.n2D(n - c, r),
            H = (m - R) / (2 * c);
        return [-((F - U) / (2 * c)), H];
    }
    randomPow(n) {
        return Math.pow(this.random(), n);
    }
    random2(n) {
        const r = Math.sin(n * 12.9898) * 43758.5453;
        return r - Math.floor(r);
    }
}
const t = new un();
new un(!0);
const We = (e) => {
        const n = [...e];
        for (let r = n.length - 1; r > 0; r--) {
            const c = Math.floor(t.random() * (r + 1));
            [n[r], n[c]] = [n[c], n[r]];
        }
        return n;
    },
    Wt = (e, n, r) => {
        const c = Math.min(n, r),
            m = Math.max(n, r);
        return Math.min(Math.max(e, c), m);
    },
    Bt = (e, n, r, c, m, R = !1) => {
        let F = c + ((m - c) * (e - n)) / (r - n);
        return R && (F = Wt(F, c, m)), F;
    },
    Se = (e, n, r) => e * (1 - r) + n * r,
    jn = ({ r: e, g: n, b: r }) => "#" + ((1 << 24) + (e << 16) + (n << 8) + r).toString(16).slice(1),
    Hn = ({ h: e, s: n, l: r }) => {
        (n /= 100), (r /= 100);
        let c = (1 - Math.abs(2 * r - 1)) * n,
            m = c * (1 - Math.abs(((e / 60) % 2) - 1)),
            R = r - c / 2,
            F = 0,
            U = 0,
            H = 0;
        return (
            0 <= e && e < 60
                ? ((F = c), (U = m), (H = 0))
                : 60 <= e && e < 120
                  ? ((F = m), (U = c), (H = 0))
                  : 120 <= e && e < 180
                    ? ((F = 0), (U = c), (H = m))
                    : 180 <= e && e < 240
                      ? ((F = 0), (U = m), (H = c))
                      : 240 <= e && e < 300
                        ? ((F = m), (U = 0), (H = c))
                        : 300 <= e && e < 360 && ((F = c), (U = 0), (H = m)),
            (F = Math.round((F + R) * 255)),
            (U = Math.round((U + R) * 255)),
            (H = Math.round((H + R) * 255)),
            { r: F, g: U, b: H }
        );
    },
    Xe = (e) => {
        if (e.s) return e;
        let n = 0,
            r = 0,
            c = 0;
        e.length == 4
            ? ((n = "0x" + e[1] + e[1]), (r = "0x" + e[2] + e[2]), (c = "0x" + e[3] + e[3]))
            : e.length == 7 && ((n = "0x" + e[1] + e[2]), (r = "0x" + e[3] + e[4]), (c = "0x" + e[5] + e[6])),
            (n /= 255),
            (r /= 255),
            (c /= 255);
        let m = Math.min(n, r, c),
            R = Math.max(n, r, c),
            F = R - m,
            U = 0,
            H = 0,
            J = 0;
        return (
            F == 0
                ? (U = 0)
                : R == n
                  ? (U = ((r - c) / F) % 6)
                  : R == r
                    ? (U = (c - n) / F + 2)
                    : (U = (n - r) / F + 4),
            (U = Math.round(U * 60)),
            U < 0 && (U += 360),
            (J = (R + m) / 2),
            (H = F == 0 ? 0 : F / (1 - Math.abs(2 * J - 1))),
            (H = +(H * 100).toFixed(1)),
            (J = +(J * 100).toFixed(1)),
            { h: U, s: H, l: J }
        );
    },
    Qn = (e) => {
        e = e.replace(/^#/, "");
        let n, r, c;
        return (
            e.length === 3
                ? ((n = parseInt(e[0] + e[0], 16)), (r = parseInt(e[1] + e[1], 16)), (c = parseInt(e[2] + e[2], 16)))
                : ((n = parseInt(e.slice(0, 2), 16)),
                  (r = parseInt(e.slice(2, 4), 16)),
                  (c = parseInt(e.slice(4, 6), 16))),
            { r: n, g: r, b: c }
        );
    },
    tn = (e) => {
        const { r: n, g: r, b: c } = Qn(e);
        return 0.2126 * n + 0.7152 * r + 0.0722 * c;
    },
    en = (e) => jn(Hn(e));
for (let e = 0; e < 100; e++) t.random();
const Jn = !0,
    Kn = !1,
    to = 4,
    eo = "l";
let gn = t.int(3, 15),
    kt = eo,
    yn = kt == "h" && t.bool(0);
kt == "l" && t.bool(0.005) && (kt = "m");
const no = "none",
    pn = 1.2;
let de = !1,
    mn = kt !== "h" && t.bool(0.07);
const oo = kt == "h" ? "grandeur" : "Un air de grandeur",
    x = {
        GRIBOUILLIS: "gribouillis",
        GRANDEUR: oo,
        VERTICAL: "vertical",
        HORIZONTAL: "horizontal",
        GRID: "grid",
        UNGRID: "ungrid",
        FIELD: "field",
        LANDSCAPE: "landscape",
        CONCENTRIC: "concentric",
        LINEAR: "linear",
        PRIMITIVES: "primitives",
        INTERSECTIONS: "intersections",
        OPRIMITIVES: "oprimitives",
        OINTERSECTIONS: "ointersections",
        ROOM: "room",
        RANDOMLINES: "randomLines",
        PRIMGRID: "primgrid",
        ROTATEDGRID: "rotatedgrid",
        FULLGRID: "fullgrid",
    },
    so = {
        [x.GRIBOUILLIS]: "Gestuelle: gribouillis",
        [x.GRANDEUR]: kt == "h" ? "Ext\xE9rieur" : "Gestuelle: gros gribouillis",
        [x.VERTICAL]: "\xC9chauffement: vertical",
        [x.HORIZONTAL]: "\xC9chauffement: horizontal",
        [x.GRID]: "Structure: grille",
        [x.UNGRID]: "Structure: grille moins uniforme",
        [x.FIELD]: "La base",
        [x.CONCENTRIC]: "Structure: r\xE9p\xE9tition concentrique",
        [x.LINEAR]: "Structure: r\xE9p\xE9tition lin\xE9aire",
        [x.PRIMITIVES]: "Structure: primitives opaques",
        [x.INTERSECTIONS]: "Structure: primitives transparentes",
        [x.OPRIMITIVES]: "Structure: primitives opaques et organiques",
        [x.OINTERSECTIONS]: "Structure: primitives transparentes et organiques",
        [x.LANDSCAPE]: "Structure: paysage",
        [x.ROOM]: "Contexte: int\xE9rieur",
        [x.RANDOMLINES]: "Structure: lignes al\xE9atoires",
        [x.PRIMGRID]: "Structure: grille",
    };
let Jt = [x.PRIMITIVES, x.INTERSECTIONS, x.OPRIMITIVES, x.OINTERSECTIONS],
    Ne = [];
const io = t.random();
io < 1e-4 && kt == "h" && (Ne = [x.FULLGRID]);
t.bool(0.01) && kt !== "h" && (Ne = [x.GRIBOUILLIS]);
t.bool(0.5) &&
    ((de = kt !== "h" && t.bool(1 / 15)),
    (Jt = Jt.concat([
        x.VERTICAL,
        x.HORIZONTAL,
        x.GRID,
        x.UNGRID,
        x.FIELD,
        x.CONCENTRIC,
        x.LINEAR,
        x.ROOM,
        x.GRANDEUR,
    ])));
kt == "h" &&
    ((de = t.bool(0.008)),
    (Jt = Jt.filter((e) => e !== x.HORIZONTAL && e !== x.FIELD)),
    (Jt = [
        x.GRANDEUR,
        x.UNGRID,
        x.CONCENTRIC,
        x.LINEAR,
        x.PRIMITIVES,
        x.INTERSECTIONS,
        x.OPRIMITIVES,
        x.OINTERSECTIONS,
        x.ROOM,
        x.PRIMGRID,
        x.ROTATEDGRID,
    ]));
de && (Jt = [x.VERTICAL, x.PRIMITIVES, x.OPRIMITIVES]);
let q = [];
if (kt == "h") {
    const e = t.random() < 0.5 ? 1 : t.int(2, 4);
    if (t.bool(0.5) && e > 1) {
        const r = t.bool(0.5);
        r ? q.push(x.ROOM) : q.push(x.GRANDEUR), t.bool(0.5) && (r ? q.push(x.GRANDEUR) : q.push(x.ROOM));
    }
    for (; q.length < e; ) {
        let r = Jt.filter((m) => m !== x.ROOM && m !== x.GRANDEUR);
        const c = t.pick(r);
        q.includes(c) || q.push(c);
    }
    if (
        (t.bool(0.5) && !q.includes(x.ROOM) && q.push(x.ROOM),
        q.length == 1 && (q[0] == x.PRIMGRID || q[0] == x.UNGRID || q[0] == x.ROTATEDGRID))
    ) {
        let r = Jt.filter((c) => c !== x.PRIMGRID && c !== x.UNGRID && c !== x.ROTATEDGRID);
        q.push(t.pick(r));
    }
    q.includes(x.PRIMGRID) && (q = [x.PRIMGRID, ...q.filter((r) => r !== x.PRIMGRID)]);
    let n = 0.5;
    q.includes(x.GRANDEUR) && (n = 0.2), q.includes(x.FULLGRID) && (n = 0.8), t.bool(n) && q.push(x.RANDOMLINES);
} else {
    const e = t.int(0, Jt.length - 1),
        n = Jt[e];
    if ((q.push(n), t.bool(0.03))) {
        const r = Jt.filter((c) => c !== x.FIELD && !q.includes(c));
        r.length > 0 && q.push(r[t.int(0, r.length - 1)]);
    }
    if (de) {
        const r = t.int(1, 3);
        for (gn = t.int(1, 5), q = []; q.length < r; ) {
            const c = t.pick(Jt);
            q.includes(c) || q.push(c);
        }
        t.bool(0.3) && (q = [x.FIELD]);
    }
}
t.bool(0.01) && (q = [x.ROOM]);
t.bool(0.01) && (q = [x.GRANDEUR]);
Ne.length > 0 && (q = Ne);
kt !== "h" && q.includes(x.GRANDEUR) && (mn = !0);
q.includes(x.ROOM) && t.bool(0.3) && (q = [...q.filter((e) => e !== x.ROOM), x.ROOM]);
const bn = 100,
    lo = [420, 595],
    jt = lo,
    nn = 1.5;
{
    const e = jt[0];
    (jt[0] = jt[1]), (jt[1] = e);
}
jt[0] = jt[0] * (bn / 72);
jt[1] = jt[1] * (bn / 72);
jt[0] *= pn;
jt[1] *= pn;
const ro = 12;
let xn = 1;
if (t.bool(0.995)) {
    const e = t.bool(0.7) ? 3 : 2;
    xn = t.int(e, ro);
}
let ce = We([...$e]).slice(0, xn);
t.bool(0.015) && (ce = ["#D4011D", "#EB6E81", "#FECD1A", "#0262A7", "#628B2A", "#000000"]);
t.bool(0.001) && (ce = We($e));
t.bool(0.02) &&
    ((ce = ["#757575", "#616161", "#424242", "#212121", "#010101"]),
    t.bool(0.5) && (ce = t.bool(0.5) ? ["#424242", "#212121"] : ["#757575"]));
ce = We(ce);
let Ve = Array.from(ce).sort((e, n) => {
    const r = Math.round(tn(e) * 1e6) / 1e6;
    return Math.round(tn(n) * 1e6) / 1e6 - r;
});
for (let e = 0; e < Ve.length; e++)
    console.log(`%c   ${Ve[e]}   `, `background: ${Ve[e]}; color: white; padding: 2px 5px; border-radius: 2px;`);
let In = kt == "h" ? t.bool(0.15) : t.bool(0.03),
    Mn = "#eae4cc",
    Sn = In ? t.pick(ce) : Mn,
    co = kt == "h" ? t.bool(0) : !1,
    ao = q.length == 1 && q[0] == x.GRANDEUR && t.bool(0.1),
    ho = t.int(1, 5),
    qe = ["c"];
yn && ((kt = "m"), (qe = ["b", "c"]));
let Kt = ["o", "oc"],
    fo = !0,
    Cn = t.bool(0.75) && !yn ? 1.2 : t.range(0, 0.4),
    Ze = t.bool(0.99) ? 0 : t.range(0, 1),
    je = t.random(),
    xe = 1;
je < 0.7 && (xe = 0);
je < 0.5 && (xe = t.range(0.6, 1));
je < 0.3 && (xe = t.range(0.15, 0.4));
let Rn = [1],
    kn = kt == "h" ? t.pick([0.6, 1]) : 1,
    uo = t.bool(0.5) ? 0 : t.range(0.2, 1.4),
    vn = t.bool(0.5) || t.bool(0.03) ? 1 : t.range(0, 1),
    Ie = t.bool(0.9) ? t.range(0.05, 0.25) : 0.5,
    go = t.bool(0.99) ? t.range(0.2, 0.27) * t.pick([1, 3, 5]) : 5,
    yo = t.bool(0.2),
    po = t.bool(0.3),
    Te = !1;
const mo = t.pick([
    ["bottom", "right"],
    ["bottom", "left"],
    ["bottom", "left", "right"],
]);
let He = 1,
    bo = t.pick([0.5, 0.9, 1, 1]);
kt == "h" && ((Te = t.bool(0.0085)), (He = t.bool(0.8) ? 1 : 0.75));
let wn = kt == "h" ? t.bool(0.92) : !0;
q.length <= 2 && q.includes(x.CONCENTRIC) && (wn = !1);
Te && q.includes(x.ROOM) && (q = [...q.filter((e) => e !== x.ROOM), x.ROOM]);
He < 1 && ((Te = !1), (Ze = 0));
let Dn = !1;
kt !== "h" &&
    q.length == 1 &&
    (q[0] == x.PRIMITIVES || q[0] == x.INTERSECTIONS || q[0] == x.OPRIMITIVES || q[0] == x.OINTERSECTIONS) &&
    (Dn = t.bool(0.01));
const An = q.filter((e) => e !== x.ROOM && e !== x.GRANDEUR).length;
let fe = t.bool(0.5);
An >= 3 && !fe && (fe = t.bool(0.7));
An == 1 && ((fe = t.bool(0.15)), q.includes(x.PRIMGRID) && !fe && (fe = t.bool(0.75)));
kt !== "h" && (fe = !1);
t.bool(0.02) && (Ie = 1);
kt == "h" && (Ie = t.range(0.01, 0.1));
((kt == "h" && t.bool(0.15)) || (kt !== "h" && t.bool(0.3))) && (Ie = 0);
let we = kt == "h" || de ? !0 : t.bool(0.6);
q.length == 1 && (q[0] == "horizontal" || q[0] == "vertical" || q[0] == "grid") && (we = !0);
q.length == 1 && q[0] == x.GRIBOUILLIS && kt !== "h" && (we = !1);
const xo = kt == "h" ? 0 : 0.3,
    Io = kt == "h" ? 0.2 : 0.6;
let Mo = t.bool(0.95) ? 0 : t.range(xo, Io),
    On = 1,
    En = Ie == 0 && kt == "h" ? t.range(0, 0.01) : 0.05,
    _e = t.range(0.07, 0.15),
    So = !1,
    Co = kt == "h" ? t.bool(0.1) : t.bool(0.5),
    Pn = kt == "h" ? t.bool(0.35) : t.bool(0.5);
q.length == 1 && q[0] == x.GRANDEUR && (Pn = t.bool(0.65));
(q.includes(x.VERTICAL) || q.includes(x.HORIZONTAL)) && (we = !0);
let Ro = t.bool(0.5);
kt !== "h" &&
    qe.length == 1 &&
    ((Cn = 2),
    (Ze = 0),
    (Sn = Mn),
    (xe = t.bool(0.35) ? 1 : t.range(0, 0.6)),
    !we && t.bool(0.5) && (xe = t.range(0, 0.7)),
    (Rn = [1]),
    (On = t.bool(0.5) ? 1 : t.range(0.1, 0.4)),
    (En = t.bool(0.7) ? 0.05 : t.range(0.25, 0.5)),
    (Kt = ["h", "o", "c", "v", "n"]),
    t.bool(0.05) && (Kt = ["v"]),
    (t.bool(0.005) || (de && t.bool(1.1))) && (Kt = ["h"]),
    q.length == 1 && q[0] == "vertical" && (Kt = t.bool(0.5) ? ["h", "v", "n"] : ["v"]),
    q.length == 1 && q[0] == "horizontal" && (Kt = t.bool(0.5) ? ["h", "v", "n"] : ["h"]),
    q.length == 1 &&
        q[0] == x.FIELD &&
        ((kn = t.pick([0.3, 0.5, 0.5, 1, 1])),
        t.bool(0.5) ? ((Kt = ["n"]), (_e = t.range(0.1, 0.35))) : ((Kt = ["c"]), (_e = t.range(0.3, 1))),
        t.bool(0.05) && (kt = "m")));
const ko = t.pick([[-5], [-0, -1, -2, -3, -4, -5]]),
    vo = t.pick([[-5], [-5, -4, -3]]),
    wo = t.pick([
        [-5, -10],
        [-6, -8],
    ]);
let Fn = { normOffsetOpts: wo, noiseScl: 3.5, noiseAmp: t.range(7, 15) },
    Do = { normOffsetOpts: vo, noiseScl: 2, noiseAmp: t.range(7, 10) },
    Qe = { normOffsetOpts: kt == "h" ? [-5] : ko, noiseScl: 3, noiseAmp: t.pick([1.5, 5, 1.5]) },
    Ge = Qe;
Ge = t.pick([Qe, Do, Fn]);
Ge = Qe;
Kt.length == 1 && Kt[0] == "v" && (Ge = Fn);
Kt.length == 1 && Kt[0] == "h" && (vn = 0);
const d = {
    isBuild: Jn,
    batching: Kn,
    dimensions: { base: jt, final: [jt[0] * nn, jt[1] * nn], debugScl: 0.3, rebelleScl: 2 },
    useColorBg: In,
    backgroundColor: Sn,
    palette: ce,
    comps: q,
    availableComps: Jt,
    NB_FRAMES: 240,
    targetFPS: 60,
    animate: !1,
    plotMode: no,
    density: kt,
    tangentModeOpts: Kt,
    fillBackground: fo,
    isLandscape: de,
    presence: "l",
    skipContour: xe,
    simline: 1,
    rotateSkew: uo,
    contained: vn,
    neg: Cn,
    negMode: kt == "h" ? t.pick(["f", "f"]) : t.pick(["e"]),
    bfill: we,
    gradient: Ze,
    colorrep: t.bool(0.7) ? "r" : "n",
    isStrokeColorFromB: Mo,
    othercolor: Ie,
    othercolorScl: go,
    darkOtherColorInBg: yo,
    dirtyBgColor: po,
    fuzinessOpts: Rn,
    tScl: kn,
    geomOffset: Ge,
    multiplyAmount: En,
    baseEllipseWidthScl: On,
    compNseScl: _e,
    mpress: So,
    rough: mn,
    sim: Co,
    smalls: Pn,
    uniformBg: co,
    isolation: ao,
    nbIsolated: ho,
    bonly: Dn,
    masks: fe,
    windo: Ro,
    light: Te,
    lightSides: mo,
    press: He,
    vstrokes: wn,
    vgridSpacing: t.pick([5, 10]),
    maskChance: bo,
    gridSpacing: to,
    shapes: { count: gn, size: [0.05 * jt[1], 0.5 * jt[1]] },
    layers: qe,
};
let Le = "";
kt !== "h" && (Le = q.length == 1 ? so[q[0]] : "mixed");
Le !== "" && console.log(Le);
window.$artifact = { features: { trait: Le } };
function Ao(e) {
    return { strideX: e[1], data: new Uint32Array(e[0] * e[1]) };
}
var Oo = Ao,
    Eo = Oo,
    Nn = Math.PI / 3,
    ze = [
        [0, 0],
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [0, -2],
        [-2, 0],
        [2, 0],
        [0, 2],
        [-1, -2],
        [1, -2],
        [-2, -1],
        [2, -1],
        [-2, 1],
        [2, 1],
        [-1, 2],
        [1, 2],
    ],
    Po = ze.length;
function Ut(e, n) {
    (this.width = e.shape[0]),
        (this.height = e.shape[1]),
        (this.radius = e.radius || e.minDistance),
        (this.maxTries = Math.max(3, Math.ceil(e.tries || 30))),
        (this.rng = n || Math.random);
    const c = 1e-14 * Math.max(1, (Math.max(this.width, this.height) / 64) | 0),
        m = 2e-14;
    (this.squaredRadius = this.radius * this.radius),
        (this.radiusPlusEpsilon = this.radius + c),
        (this.cellSize = this.radius * Math.SQRT1_2),
        (this.angleIncrement = (Math.PI * 2) / this.maxTries),
        (this.angleIncrementOnSuccess = Nn + m),
        (this.triesIncrementOnSuccess = Math.ceil(this.angleIncrementOnSuccess / this.angleIncrement)),
        (this.processList = []),
        (this.samplePoints = []),
        (this.gridShape = [Math.ceil(this.width / this.cellSize), Math.ceil(this.height / this.cellSize)]),
        (this.grid = Eo(this.gridShape));
}
Ut.prototype.width = null;
Ut.prototype.height = null;
Ut.prototype.radius = null;
Ut.prototype.radiusPlusEpsilon = null;
Ut.prototype.squaredRadius = null;
Ut.prototype.cellSize = null;
Ut.prototype.angleIncrement = null;
Ut.prototype.angleIncrementOnSuccess = null;
Ut.prototype.triesIncrementOnSuccess = null;
Ut.prototype.maxTries = null;
Ut.prototype.rng = null;
Ut.prototype.processList = null;
Ut.prototype.samplePoints = null;
Ut.prototype.gridShape = null;
Ut.prototype.grid = null;
Ut.prototype.addRandomPoint = function () {
    return this.directAddPoint([this.rng() * this.width, this.rng() * this.height, this.rng() * Math.PI * 2, 0]);
};
Ut.prototype.addPoint = function (e) {
    var n = e.length === 2 && e[0] >= 0 && e[0] < this.width && e[1] >= 0 && e[1] < this.height;
    return n ? this.directAddPoint([e[0], e[1], this.rng() * Math.PI * 2, 0]) : null;
};
Ut.prototype.directAddPoint = function (e) {
    var n = [e[0], e[1]];
    this.processList.push(e), this.samplePoints.push(n);
    var r = ((e[0] / this.cellSize) | 0) * this.grid.strideX + ((e[1] / this.cellSize) | 0);
    return (this.grid.data[r] = this.samplePoints.length), n;
};
Ut.prototype.inNeighbourhood = function (e) {
    var n = this.grid.strideX,
        r = this.gridShape[0],
        c = this.gridShape[1],
        m = (e[0] / this.cellSize) | 0,
        R = (e[1] / this.cellSize) | 0,
        F,
        U,
        H,
        J,
        L;
    for (F = 0; F < Po; F++)
        if (
            ((H = m + ze[F][0]),
            (J = R + ze[F][1]),
            (U = H < 0 || J < 0 || H >= r || J >= c ? -1 : H * n + J),
            U !== -1 &&
                this.grid.data[U] !== 0 &&
                ((L = this.samplePoints[this.grid.data[U] - 1]),
                Math.pow(e[0] - L[0], 2) + Math.pow(e[1] - L[1], 2) < this.squaredRadius))
        )
            return !0;
    return !1;
};
Ut.prototype.next = function () {
    for (var e, n, r, c; this.processList.length > 0; ) {
        var m = (this.processList.length * this.rng()) | 0;
        for (
            n = this.processList[m], r = n[2], e = n[3], e === 0 && (r = r + (this.rng() - 0.5) * Nn * 4);
            e < this.maxTries;
            e++
        ) {
            if (
                ((c = [n[0] + Math.cos(r) * this.radiusPlusEpsilon, n[1] + Math.sin(r) * this.radiusPlusEpsilon, r, 0]),
                c[0] >= 0 && c[0] < this.width && c[1] >= 0 && c[1] < this.height && !this.inNeighbourhood(c))
            )
                return (
                    (n[2] = r + this.angleIncrementOnSuccess + this.rng() * this.angleIncrement),
                    (n[3] = e + this.triesIncrementOnSuccess),
                    this.directAddPoint(c)
                );
            r = r + this.angleIncrement;
        }
        if (e >= this.maxTries) {
            const R = this.processList.pop();
            m < this.processList.length && (this.processList[m] = R);
        }
    }
    return null;
};
Ut.prototype.fill = function () {
    for (this.samplePoints.length === 0 && this.addRandomPoint(); this.next(); );
    return this.samplePoints;
};
Ut.prototype.getAllPoints = function () {
    return this.samplePoints;
};
Ut.prototype.reset = function () {
    var e = this.grid.data,
        n;
    for (n = 0; n < e.length; n++) e[n] = 0;
    (this.samplePoints = []), (this.processList.length = 0);
};
var Ln = Ut;
const on = d.shapes.count,
    Fo = () => {
        t.random();
        let e = d.dimensions.base[0],
            n = d.dimensions.base[1],
            r = e / n,
            c = null,
            m = null,
            R = null,
            F = null,
            U = -1,
            H = [],
            J = 1;
        d.density == "h" && (J = 4);
        let L = [],
            yt = [];
        const vt = () => {},
            St = () => c,
            ot = () => R,
            mt = () => {
                const C = ft(e / 2 - e * 0.05, n - n * t.range(0.1, 0.18), e * 1.1, n * 0.4, 0, 10),
                    P = d.density == "h" ? !0 : t.bool(0.5);
                let A = t.pick([0, 0.5, 1]);
                const s = 0.03 * e;
                for (let h = 0; h < C.length; h++) {
                    const o = C[h].x / e,
                        l = C[h].y / n,
                        a = 0,
                        p = 0;
                    let f = s;
                    (f *= Bt(l, 0.7, 1, 1, 0)),
                        (C[h].x += t.n2D((o * r + a) * A * r, (l + a) * A) * f),
                        (C[h].y += t.n2D((o * r + p) * A * r, (l + p) * A) * f);
                }
                L.push({ points: C, isFilled: P, fillColor: "white", strokeColor: "black" });
            },
            j = (C = e / 2, P = n / 2) => {
                const A = t.range(0.8, 1.5),
                    s = e * t.range(0.2, 0.35) * A,
                    h = n * t.range(0.2, 0.6) * A;
                let o = J == 1 ? t.bool(0.15) : t.bool(0.5);
                d.light && (o = !1), (C = t.range(e * 0.25, e * 0.75)), (P = t.range(n * 0.25, n * 0.75));
                const l = t.bool(0.5) ? 0 : t.range(-Math.PI / 6, Math.PI / 6);
                let a = d.density == "h" ? t.bool(0.5) : !1;
                d.windo && (a = !1), d.light && d.lightSides.includes("bottom") && (a = !0);
                const p = C - s / 2,
                    f = C + s / 2,
                    y = P - h / 2,
                    u = P + h / 2,
                    v = (G, $, Z, O, B) => {
                        const bt = G - Z,
                            ut = $ - O;
                        return {
                            x: Z + (bt * Math.cos(B) - ut * Math.sin(B)),
                            y: O + (bt * Math.sin(B) + ut * Math.cos(B)),
                        };
                    },
                    _ = v(p, y, C, P, l),
                    g = v(f, y, C, P, l),
                    b = v(f, u, C, P, l),
                    E = v(p, u, C, P, l),
                    z = ft(C, P, s, h, l, 10);
                if ((L.push({ points: z, isFilled: !1, fillColor: "white", strokeColor: "black" }), !o)) {
                    const G = (d.density == "h" && t.bool(0.05)) || (d.light && d.lightSides.includes("top"));
                    L.push({
                        points: [{ x: 0, y: 0 }, _, g, { x: e, y: 0 }],
                        isFilled: G,
                        isDoorSide: !0,
                        side: "top",
                    });
                    const $ = (d.density == "h" && t.bool(0.05)) || (d.light && d.lightSides.includes("right"));
                    L.push({
                        points: [{ x: e, y: 0 }, g, b, { x: e, y: n }],
                        isFilled: $,
                        isDoorSide: !0,
                        side: "right",
                    });
                    const Z = (d.density == "h" && t.bool(0.05)) || (d.light && d.lightSides.includes("left"));
                    L.push({
                        points: [{ x: 0, y: 0 }, _, E, { x: 0, y: n }],
                        isFilled: Z,
                        isDoorSide: !0,
                        side: "left",
                    });
                }
                L.push({
                    points: [{ x: 0, y: n }, E, b, { x: e, y: n }],
                    isFilled: a,
                    fillColor: "white",
                    strokeColor: "black",
                    isDoorSide: !0,
                    side: "bottom",
                });
            },
            st = () => {
                let C = t.bool(0.5) ? 1 : t.int(2, J);
                for (let P = 0; P < C; P++) j();
            },
            W = (C, P, A, s, h, o = 0, l = 0, a = 1, p = 1) => {
                const f = N(),
                    y = A / h,
                    u = s / h,
                    v = ft(C, P, A, s, o, 20);
                L.push({
                    bb: { x: C, y: P, width: A, height: s, rotation: o },
                    points: v,
                    isFilled: !1,
                    fillColor: "white",
                    strokeColor: "black",
                    type: "boundingBox",
                    func: x.ROTATEDGRID,
                    mask: f,
                }),
                    t.bool(l);
                const _ = t.bool(a),
                    g = t.bool(p),
                    b = [5, 45, 60, 90, 120],
                    E = t.pick(b),
                    z = t.bool(0.5);
                for (let G = 0; G < h; G++)
                    for (let $ = 0; $ < h; $++) {
                        let Z = C - A / 2 + y * G + y / 2,
                            O = P - s / 2 + u * $ + u / 2;
                        const B = Z - C,
                            bt = O - P,
                            ut = C + (B * Math.cos(o) - bt * Math.sin(o)),
                            Tt = P + (B * Math.sin(o) + bt * Math.cos(o)),
                            Et = ft(ut, Tt, y, u, o, 10);
                        t.range(10, 5) * 0.3;
                        for (let Ft = 0; Ft < Et.length; Ft++) Et[Ft].x / e, Et[Ft].y / n;
                        if (
                            (L.push({ points: Et, isFilled: _, fillColor: "white", strokeColor: "black", mask: f }),
                            t.bool(l))
                        ) {
                            const Ft = y > u ? u : y,
                                wt = z ? E : t.pick(b),
                                Gt = xt(ut, Tt, Ft * 0.45, o, wt);
                            L.push({ points: Gt, isFilled: g, fillColor: "white", strokeColor: "black", mask: f });
                        }
                    }
            },
            K = (C = 0, P = 1, A = 1) => {
                const s = t.bool(0.5) ? 1 : t.int(2, 3),
                    h = t.bool(0.5),
                    o = t.bool(0.5),
                    l = t.bool(0.5) ? 1 : 0.5,
                    a = t.bool(0.5) ? 1 : 0.5;
                for (let p = 0; p < s; p++) {
                    const f = t.range(0, e),
                        y = t.range(0, n),
                        u = f / e,
                        v = y / n,
                        _ = t.range(e * 0.2, e * l),
                        g = t.range(n * 0.2, n * a),
                        b = t.int(1, 4);
                    let E = o ? t.n2D(u, v) * Math.PI * 2 : t.range(0, Math.PI * 2);
                    h || (E = 0), W(f, y, _, g, b, E, C, P, A);
                }
            },
            Q = () => {
                const C = e / 2,
                    P = n / 2,
                    A = 1 * e,
                    s = 1 * n,
                    h = t.int(6, 10),
                    o = 0,
                    l = t.bool(0.5) ? 1 : t.range(0.2, 1),
                    a = t.bool(0.5) ? 1 : t.range(0.2, 1),
                    p = t.bool(0.5) ? 1 : t.range(0, 1);
                W(C, P, A, s, h, o, l, a, p);
            },
            it = (C = "y", P = [0, 0]) => {
                const A = t.int(2, 10),
                    s = C === "y",
                    h = N();
                for (let o = 0; o < A; o++) {
                    const l = ((s ? e : n) / A) * o,
                        a = [],
                        p = t.range(P[0], P[1]),
                        f = 0;
                    if (t.bool(f)) continue;
                    const u = s ? n : e;
                    for (let v = 0; v <= u + A * 2; v += A) a.push({ x: s ? l : v + p, y: s ? v + p : l });
                    L.push({ points: a, isFilled: !1, mask: h });
                }
            },
            M = () => {
                const C = ft(e / 2, n / 2, e, n, 0, 10);
                L.push({ points: C, isFilled: !0, fillColor: "white", strokeColor: "black" });
            },
            I = (C = [0, 0]) => {
                it("y", C);
            },
            i = (C = [0, 0]) => {
                it("x", C);
            },
            k = () => {
                const C = { x: 0, y: 0, width: e, height: n },
                    P = t.int(4, 8),
                    A = e / (P + 1),
                    s = n * 0.3,
                    h = n * 0.8;
                for (let o = 1; o <= P; o++) {
                    let l = A * o,
                        a = t.range(s, h),
                        p = (n - a) / 2,
                        f = p + a;
                    (l = Bt(l, 0, e, C.x, C.x + C.width)),
                        (p = Bt(p, 0, n, C.y, C.y + C.height)),
                        (f = Bt(f, 0, n, C.y, C.y + C.height));
                    const y = [
                        { x: l, y: p },
                        { x: l, y: f },
                    ];
                    L.push({ points: y, isFilled: !1 });
                }
            },
            S = (C = 30, P = 100, A = e * 0.01, s = 5, h = [0.2, 0.8]) => {
                for (let o = 0; o < C; o++) {
                    const l = [];
                    let a = t.range(e * h[0], e * h[1]),
                        p = t.range(n * h[0], n * h[1]),
                        f = t.range(0, Math.PI * 2);
                    l.push({ x: a, y: p });
                    for (let y = 0; y < P; y++) {
                        const u = t.n2D(a * 0.01, p * 0.01) * s;
                        (f += u),
                            (a += Math.cos(f) * A),
                            (p += Math.sin(f) * A),
                            (a = Wt(a, 0, e)),
                            (p = Wt(p, 0, n)),
                            l.push({ x: a, y: p });
                    }
                    L.push({ points: l, isFilled: !1 });
                }
            },
            D = () => {
                const C = t.int(1, 15),
                    P = t.bool(0.5) ? 0.5 : 0;
                for (let A = 0; A < C; A++)
                    if (t.bool(P)) {
                        const h = t.range(0, e),
                            o = t.range(0, n),
                            l = t.range(0, Math.PI * 2),
                            a = t.range(e * 0.1, e * 0.3),
                            p = 100,
                            f = t.range(Math.PI * 0.7, Math.PI * 1.5),
                            y = [];
                        for (let u = 0; u < p; u++) {
                            const v = Bt(u, 0, p, 0, f),
                                _ = h + Math.cos(v + l) * a,
                                g = o + Math.sin(v + l) * a;
                            y.push({ x: _, y: g });
                        }
                        L.push({ points: y, isFilled: !1 });
                    } else {
                        const h = t.range(0, e),
                            o = t.range(0, n),
                            l = t.range(0, Math.PI * 2),
                            a = t.range(e * 0.2, e * 0.8),
                            p = h + Math.cos(l) * a,
                            f = o + Math.sin(l) * a,
                            y = [
                                { x: h, y: o },
                                { x: p, y: f },
                            ];
                        L.push({ points: y, isFilled: !1 });
                    }
            },
            nt = () => {
                const C = N(),
                    P = t.range(0, Math.PI * 2),
                    A = t.int(3, 15),
                    s = t.bool(0.5),
                    h = t.pick([1, 10, 45, 90, 120]),
                    o = t.bool(0.5),
                    l = t.range(0, Math.PI * 2);
                for (let a = A; a > 0; a--) {
                    let p = a / A,
                        f = (a + 1) / A,
                        y = 0.8 * e * f,
                        u = e / 2,
                        v = n / 2,
                        _ = o ? p + Math.sin(Math.PI * 2 * t.random()) * 0.1 + P : l,
                        g = ft(u, v, y, y, _, 10),
                        b = s ? h : t.pick([1, 10, 45, 90, 120]);
                    t.bool(1.5) && (g = xt(u, v, y, _, b));
                    const z = { points: g, isFilled: !1, mask: C };
                    L.push(z);
                }
            },
            Y = () => {
                const C = t.int(2, 3);
                let P = d.windo ? e * t.range(0, 0.1) : 0,
                    A = d.windo ? n * t.range(0, 0.1) : 0;
                t.bool(0.2) && (P = A = t.range(0, 0.1) * e);
                const h = e - P * 2,
                    l = (n - A * 2) / C,
                    a = Math.floor(h / l),
                    p = l * 0.85,
                    f = l,
                    y = t.bool(0.5),
                    u = t.pick([1, 10, 45, 90, 120]);
                t.range(0, Math.PI * 2);
                const v = N();
                for (let _ = 0; _ < C; _++)
                    for (let g = 0; g < a; g++) {
                        const b = P + g * l + l / 2,
                            E = A + _ * l + l / 2,
                            z = t.range(0, Math.PI * 2),
                            G = y ? u : t.pick([1, 10, 45, 90, 120]),
                            $ = ft(b, E, f, f, 0, G);
                        L.push({ points: $, isFilled: !1, fillColor: "white", strokeColor: "black", mask: v });
                        const Z = xt(b, E, p / 2, z, G);
                        L.push({ points: Z, isFilled: !1, fillColor: "white", strokeColor: "black", mask: v });
                    }
            },
            w = (C = 0.5, P = 0.5, A = 1) => {
                const s = N(),
                    h = on,
                    o = t.bool(P),
                    l = n * t.range(0.5, 1),
                    a = t.bool(C),
                    p = t.pick([1, 45, 60, 90, 120]),
                    f = t.range(0, Math.PI),
                    y = e / h,
                    u = t.bool(0.5);
                for (let v = 0; v < h * 2; v++) {
                    const _ = u ? e - v * y : v * y,
                        g = n / 2,
                        b = o ? l : l * t.range(1, 0.5),
                        E = f,
                        z = a ? p : t.pick([1, 5, 10, 45, 90, 120]),
                        G = xt(_, g, b, E, z);
                    t.pick([1, 5]);
                    let $ = t.bool(A);
                    for (let Z = 0; Z < G.length; Z++) G[Z].x / e, G[Z].y / n;
                    L.push({ points: G, isFilled: $, fillColor: "white", strokeColor: "black", mask: s });
                }
            },
            X = (C = 1, P = 0) => {
                const A = N(),
                    s = e / n,
                    h = t.range(0, Math.PI * 2),
                    o = t.bool(0.5);
                let l = t.pick([1, 1, 10, 45, 90, 120]);
                const a = t.bool(0.5) ? 1 : 0.5,
                    p = t.range(0.65, 1.5) * a;
                let f = d.density == "h" ? t.bool(0.5) : !0,
                    y = 360;
                d.density == "h" && (y = t.bool(0.7) ? 360 : 270);
                const u = t.pick([1, 3, 5, t.pick([1, 5])]);
                for (let v = 0; v < on; v++) {
                    let _ = Bt(Math.pow(t.random(), 1), 0, 1, 0.1, 0.6) * n * p;
                    const g = 0.1 * e;
                    let b = t.range(g, e - g),
                        E = t.range(g, n - g),
                        z = t.bool(P);
                    const G = 0.7,
                        $ = 1;
                    let Z = h + t.n2D(b * G, E * G) * $,
                        O = t.bool(C),
                        B = o ? l : t.pick([1, 1, 10, 45, 90, 120]),
                        bt = [],
                        ut = y;
                    d.density == "h" && !f && (ut = t.bool(0.5) ? 270 : 360), (bt = xt(b, E, _, Z, B, ut));
                    let Tt = u;
                    Array.isArray(u) && (Tt = t.pick(u));
                    const Et = 0.07 * e;
                    for (let wt = 0; wt < bt.length; wt++) {
                        const Gt = bt[wt].x / e,
                            Rt = bt[wt].y / n,
                            Ht = b,
                            Nt = E;
                        let Ot = Et;
                        z &&
                            ((bt[wt].x += t.n2D((Gt * s + Ht) * Tt * s, (Rt + Ht) * Tt) * Ot),
                            (bt[wt].y += t.n2D((Gt * s + Nt) * Tt * s, (Rt + Nt) * Tt) * Ot));
                    }
                    const Ft = { points: bt, isFilled: O, mask: A };
                    O && ((Ft.fillColor = "white"), (Ft.strokeColor = "black")), L.push(Ft);
                }
            },
            V = (C = 0.5, P = 4) => {
                const A = N(),
                    s = (a, p, f, y, u, v) => {
                        if (u <= 0 || (f < e * 0.1 && y < n * 0.1)) {
                            const b = t.range(-0.2, 0.2) * 0;
                            let E = ft(a + f / 2, p + y / 2, f, y, b, 10);
                            for (let z = 0; z < E.length; z++) {
                                const G = E[z].x / e,
                                    $ = E[z].y / n;
                                t.n2D(G * 4, $ * 4) * 0.1 * e;
                            }
                            L.push({ points: E, isFilled: t.bool(0.5), mask: A });
                            return;
                        }
                        const _ = Bt(u, P, 0, 0.2, 0.4),
                            g = Bt(u, P, 0, 0.8, 0.6);
                        if (v) {
                            const b = f * t.range(_, g);
                            s(a, p, b, y, u - 1, !1), s(a + b, p, f - b, y, u - 1, !1);
                        } else {
                            const b = y * t.range(_, g);
                            s(a, p, f, b, u - 1, !0), s(a, p + b, f, y - b, u - 1, !0);
                        }
                    },
                    h = d.windo ? e * 0.1 : 0,
                    o = d.windo ? n * 0.05 : 0,
                    l = t.bool(0.5);
                s(h, o, e - h * 2, n - o * 2, P, l);
            },
            N = () => (U++, U >= yt.length && (U = 0), yt[U]),
            T = () => {
                yt = [];
                const C = (o, l, a, p, f, y) => {
                        if (f <= 0 || (a < e * 0.1 && p < n * 0.1)) {
                            const _ = ft(o + a / 2, l + p / 2, a, p, 0, 10),
                                g = t.pick([1, 2, 1, 2, 1, 2, 10]);
                            let b = t.bool(0.9) ? 0.07 : 0.17;
                            (b *= e), t.bool(0.5) && (b *= 0);
                            for (let E = 0; E < _.length; E++) {
                                const z = _[E].x / e,
                                    G = _[E].y / n,
                                    $ = o,
                                    Z = l;
                                let O = b;
                                (_[E].x += t.n2D((z * r + $) * g * r, (G + $) * g) * O),
                                    (_[E].y += t.n2D((z * r + Z) * g * r, (G + Z) * g) * O);
                            }
                            yt.push({ points: _, isFilled: !1, fillColor: "white", strokeColor: "black" });
                            return;
                        }
                        const u = Bt(f, s, 0, 0.1, 0.3),
                            v = Bt(f, s, 0, 0.9, 0.7);
                        if (y) {
                            const _ = a * t.range(u, v);
                            C(o, l, _, p, f - 1, !1), C(o + _, l, a - _, p, f - 1, !1);
                        } else {
                            const _ = p * t.range(u, v);
                            C(o, l, a, _, f - 1, !0), C(o, l + _, a, p - _, f - 1, !0);
                        }
                    },
                    P = d.windo ? e * 0.1 : 0,
                    A = d.windo ? n * 0.05 : 0;
                H = d.comps.filter((o) => o !== x.ROOM && o !== x.GRANDEUR && o !== x.RANDOMLINES);
                let s = H.length;
                t.bool(0.5) && (s -= 1), (s = Wt(s, 1, 2)), t.bool(0.15) && (s = t.bool(0.5) ? 3 : 4);
                const h = t.bool(0.5);
                C(P, A, e - P * 2, n - A * 2, s, h),
                    (yt = yt
                        .map((o) => ({ value: o, sort: t.random() }))
                        .sort((o, l) => o.sort - l.sort)
                        .map(({ value: o }) => o)),
                    yt.length > 8 && d.smalls && (d.smalls = t.bool(0.2));
            },
            lt = (C) => {
                for (let P = 0; P < C.length; P++) {
                    const A = C[P];
                    if (A === x.VERTICAL) t.bool(0.5) ? I() : V(1, t.int(3, 4));
                    else if (A === x.HORIZONTAL) i();
                    else if (A === x.GRID) I(), i();
                    else if (A === x.UNGRID) {
                        let s = t.range(0.15, 0.8);
                        (s = t.bool(0.2) ? 1 : s), (s = t.bool(0.2) ? 0 : s);
                        const h = d.density == "h" ? t.int(2, 4) : t.int(2, 6);
                        V(s, h);
                    } else if (A === x.FIELD) M();
                    else if (A === x.CONCENTRIC) nt();
                    else if (A === x.LINEAR) {
                        const s = d.density == "l" || t.bool(0.5) ? 1 : 0,
                            h = t.bool(0.5) ? 1 : 0,
                            o = t.bool(0.5) ? 1 : 0;
                        w(h, o, s);
                    } else if (A === x.PRIMITIVES) X(1, 0);
                    else if (A === x.INTERSECTIONS) {
                        const s = t.bool(0.5) ? t.range(0, 0.5) : 0;
                        X(s, 0);
                    } else if (A === x.OPRIMITIVES) X(1, 1);
                    else if (A === x.OINTERSECTIONS) {
                        const s = t.bool(0.5) ? t.range(0, 0.5) : 0;
                        X(s, 1);
                    } else if (A === x.ROOM) st();
                    else if (A === x.RANDOMLINES) D(), t.bool(0.3) && k();
                    else if (A === x.GRIBOUILLIS && d.density !== "h") {
                        const s = t.int(10, 30);
                        S(s);
                    } else if (A === x.GRIBOUILLIS && d.density == "h") {
                        let s = [0.1, 0.9],
                            h = 100,
                            o = 10,
                            l = e * 0.01;
                        S(h, o, l, 5, s);
                    } else if (A === x.GRANDEUR) {
                        let s = [0.2, 0.8],
                            h = 20,
                            o = 10,
                            l = e * 0.2,
                            a = 1;
                        t.bool(0.5) && ((h = 10), (o = t.pick([10])), (l = e * 0.2), (a = 2)), S(h, o, l, a, s);
                    } else if (A === x.PRIMGRID) Y();
                    else if (A === x.ROTATEDGRID) {
                        const s = t.bool(0.5) ? t.range(0.5, 1) : 0,
                            h = t.bool(0.5) ? 1 : 0,
                            o = t.bool(0.5) ? 1 : 0;
                        K(s, h, o);
                    } else A === x.FULLGRID && Q();
                    d.isLandscape && mt();
                }
            },
            dt = (C = d.comps) => {
                lt(C);
            },
            et = () => {
                let C = d.comps;
                if (
                    ((c = document.createElement("canvas")),
                    (c.width = e),
                    (c.height = n),
                    (c.style.width = `${e * d.dimensions.debugScl}px`),
                    (c.style.height = `${n * d.dimensions.debugScl}px`),
                    (m = c.getContext("2d")),
                    (R = document.createElement("canvas")),
                    (R.width = e),
                    (R.height = n),
                    (R.style.width = `${e * d.dimensions.debugScl}px`),
                    (R.style.height = `${n * d.dimensions.debugScl}px`),
                    (F = R.getContext("2d")),
                    (F.lineWidth = 4),
                    d.masks && T(),
                    d.masks && H.length < yt.length && t.bool(0.5))
                ) {
                    const P = yt.length - H.length,
                        A = [
                            x.CONCENTRIC,
                            x.LINEAR,
                            x.PRIMITIVES,
                            x.INTERSECTIONS,
                            x.OPRIMITIVES,
                            x.OINTERSECTIONS,
                            x.VERTICAL,
                            x.HORIZONTAL,
                        ],
                        s = [];
                    for (let h = 0; h < P; h++) s.push(t.pick(A));
                    (C = [...C, ...s]), t.bool(0.3) && (C = [...C.filter((h) => h !== x.ROOM), x.ROOM]);
                }
                dt(C);
            },
            ft = (C, P, A, s, h, o) => {
                const l = [],
                    a = { x: C, y: P },
                    p = C - A / 2,
                    f = P - s / 2;
                for (let y = 0; y <= s; y += o) {
                    let u = p,
                        v = f + y;
                    (u = Wt(u, 0, e)), (v = Wt(v, 0, n)), l.push({ x: u, y: v });
                }
                for (let y = 0; y <= A; y += o) {
                    let u = p + y,
                        v = f + s;
                    (u = Wt(u, 0, e)), (v = Wt(v, 0, n)), l.push({ x: u, y: v });
                }
                for (let y = s; y >= 0; y -= o) {
                    let u = p + A,
                        v = f + y;
                    (u = Wt(u, 0, e)), (v = Wt(v, 0, n)), l.push({ x: u, y: v });
                }
                for (let y = A; y >= 0; y -= o) {
                    let u = p + y,
                        v = f;
                    (u = Wt(u, 0, e)), (v = Wt(v, 0, n)), l.push({ x: u, y: v });
                }
                for (let y = 0; y < l.length; y++) {
                    const u = l[y].x - a.x,
                        v = l[y].y - a.y;
                    l[y] = {
                        x: Wt(a.x + (u * Math.cos(h) - v * Math.sin(h)), 0, e),
                        y: Wt(a.y + (u * Math.sin(h) + v * Math.cos(h)), 0, n),
                    };
                }
                return l;
            },
            xt = (C, P, A, s, h, o = 360) => {
                const l = [],
                    a = { x: C, y: P },
                    p = o;
                for (let f = 0; f <= p; f += h) {
                    const y = (f * Math.PI) / 180;
                    l.push({ x: C + A * Math.cos(y), y: P + A * Math.sin(y) });
                }
                for (let f = 0; f < l.length; f++) {
                    const y = l[f].x - a.x,
                        u = l[f].y - a.y;
                    l[f] = {
                        x: Wt(a.x + (y * Math.cos(s) - u * Math.sin(s)), 0, e),
                        y: Wt(a.y + (y * Math.sin(s) + u * Math.cos(s)), 0, n),
                    };
                }
                for (let f = 0; f < l.length; f++) (l[f].x = Wt(l[f].x, 0, e)), (l[f].y = Wt(l[f].y, 0, n));
                return l;
            },
            rt = (C, P = m) => {
                const A = C.points,
                    s = C.isFilled,
                    h = C.fillColor || "white";
                let o = A[0].x,
                    l = A[0].y;
                P.save(), P.beginPath(), P.moveTo(o, l);
                for (let a = 1; a < A.length; a++) {
                    const p = A[a];
                    let f = p.x,
                        y = p.y;
                    P.lineTo(f, y);
                }
                s
                    ? ((P.fillStyle = h), P.fill(), C.strokeColor && ((P.strokeStyle = C.strokeColor), P.stroke()))
                    : P.stroke(),
                    P.restore();
            },
            pt = () => {
                F.clearRect(0, 0, e, n), (F.fillStyle = "white"), F.fillRect(0, 0, e, n);
                for (let C = 0; C < yt.length; C++) rt(yt[C], F);
            },
            At = () => {
                m.clearRect(0, 0, e, n), (m.fillStyle = "white"), m.fillRect(0, 0, e, n), (m.lineWidth = 4);
                for (let C = 0; C < L.length; C++)
                    m.save(),
                        L[C].mask && d.masks && t.bool(d.maskChance) && (rt(L[C].mask), m.clip()),
                        rt(L[C]),
                        m.restore();
                m.save(),
                    (m.strokeStyle = "black"),
                    (m.fillStyle = "white"),
                    (m.lineWidth = 4),
                    m.beginPath(),
                    m.rect(0, 0, e, n),
                    m.stroke(),
                    m.restore(),
                    pt();
            },
            It = () => {
                At();
            },
            Lt = () => L;
        return et(), { getCanvas: St, getShapes: Lt, getMasksCanvas: ot, pause: vt, render: It };
    },
    No = () => {
        let e = d.dimensions.base[0],
            n = d.dimensions.base[1],
            r = null,
            c = [];
        const m = (L, yt) => {
                const vt = L / e,
                    St = yt / n;
                let ot = !1;
                const mt = 5.5;
                return t.n2D(vt * mt, St * mt) > d.neg && (ot = !0), ot;
            },
            R = (L, yt) => {
                const vt = L / e,
                    St = yt / n;
                let ot = t.pick(d.palette);
                if (d.colorrep == "n") {
                    const mt = t.bool(0.85) ? 5.5 : 1.5;
                    let j = t.n2D(vt * mt, St * mt);
                    const st = Math.floor(Bt(j, -1, 1, 0, d.palette.length - 1));
                    ot = d.palette[st];
                }
                return ot;
            },
            F = () => {
                let L = [];
                const yt = e * t.range(0.07, 0.1);
                L = new Ln({ shape: [e, n], radius: yt, tries: 20 }, t.random.bind(t));
                var vt = L.fill();
                for (let St = 0; St < vt.length; St++) {
                    const ot = vt[St];
                    let mt = R(ot[0], ot[1]);
                    const j = t.bool(0.5);
                    let st = {
                            skip: t.bool(d.skipContour),
                            opacity: t.range(0.03, 0.08) * 0.8,
                            strokeWidth: j ? 0.2 : t.range(0.07, 0.2),
                        },
                        W = m(ot[0], ot[1]);
                    W && (mt = d.backgroundColor),
                        c.push({ x: ot[0], y: ot[1], radius: yt * 0.5, color: mt, neg: W, contour: st });
                }
            },
            U = () => {
                F();
            },
            H = () => r,
            J = () => c;
        return U(), { getCanvas: H, getZones: J };
    };
var Lo = function () {
    function e(M, I) {
        (this.x = M), (this.y = I);
    }
    e.prototype.copy = function () {
        return new e(this.x, this.y);
    };
    function n(M, I) {
        (this.w = M),
            (this.h = I),
            (this.size = M * I),
            (this.arraybuffer = new ArrayBuffer(this.size)),
            (this.data = new Int8Array(this.arraybuffer));
    }
    (n.prototype.at = function (M, I) {
        return M >= 0 && M < this.w && I >= 0 && I < this.h && this.data[this.w * I + M] === 1;
    }),
        (n.prototype.index = function (M) {
            var I = new e();
            return (I.y = Math.floor(M / this.w)), (I.x = M - I.y * this.w), I;
        }),
        (n.prototype.flip = function (M, I) {
            this.at(M, I) ? (this.data[this.w * I + M] = 0) : (this.data[this.w * I + M] = 1);
        }),
        (n.prototype.copy = function () {
            var M = new n(this.w, this.h),
                I;
            for (I = 0; I < this.size; I++) M.data[I] = this.data[I];
            return M;
        });
    function r() {
        (this.area = 0),
            (this.len = 0),
            (this.curve = {}),
            (this.pt = []),
            (this.minX = 1e5),
            (this.minY = 1e5),
            (this.maxX = -1),
            (this.maxY = -1);
    }
    function c(M) {
        (this.n = M),
            (this.tag = new Array(M)),
            (this.c = new Array(M * 3)),
            (this.alphaCurve = 0),
            (this.vertex = new Array(M)),
            (this.alpha = new Array(M)),
            (this.alpha0 = new Array(M)),
            (this.beta = new Array(M));
    }
    var m = document.createElement("img"),
        R = document.createElement("canvas"),
        F = null,
        U = [],
        H,
        J = { isReady: !1, turnpolicy: "minority", turdsize: 2, optcurve: !0, alphamax: 1, opttolerance: 0.2 };
    m.onload = L;
    function L() {
        mt(), j();
    }
    function yt(M) {
        J.isReady && Q(), (m.file = M);
        var I = new FileReader();
        (I.onload = (function (i) {
            return function (k) {
                i.src = k.target.result;
            };
        })(m)),
            I.readAsDataURL(M);
    }
    function vt(M) {
        J.isReady && Q(), (m.src = M);
    }
    function St(M) {
        var I;
        for (I in M) M.hasOwnProperty(I) && (J[I] = M[I]);
    }
    function ot(M) {
        m = M;
    }
    function mt() {
        (R.width = m.width), (R.height = m.height);
        var M = R.getContext("2d");
        M.drawImage(m, 0, 0);
    }
    function j() {
        var M = R.getContext("2d");
        F = new n(R.width, R.height);
        var I = M.getImageData(0, 0, F.w, F.h),
            i = I.data.length,
            k,
            S,
            D;
        for (k = 0, S = 0; k < i; k += 4, S++)
            (D = 0.2126 * I.data[k] + 0.7153 * I.data[k + 1] + 0.0721 * I.data[k + 2]), (F.data[S] = D < 128 ? 1 : 0);
        J.isReady = !0;
    }
    function st() {
        var M = F.copy(),
            I = new e(0, 0),
            i;
        function k(Y) {
            for (var w = M.w * Y.y + Y.x; w < M.size && M.data[w] !== 1; ) w++;
            return w < M.size && M.index(w);
        }
        function S(Y, w) {
            var X, V, N;
            for (X = 2; X < 5; X++) {
                for (N = 0, V = -X + 1; V <= X - 1; V++)
                    (N += M.at(Y + V, w + X - 1) ? 1 : -1),
                        (N += M.at(Y + X - 1, w + V - 1) ? 1 : -1),
                        (N += M.at(Y + V - 1, w - X) ? 1 : -1),
                        (N += M.at(Y - X, w + V) ? 1 : -1);
                if (N > 0) return 1;
                if (N < 0) return 0;
            }
            return 0;
        }
        function D(Y) {
            var w = new r(),
                X = Y.x,
                V = Y.y,
                N = 0,
                T = 1,
                lt;
            for (
                w.sign = F.at(Y.x, Y.y) ? "+" : "-";
                w.pt.push(new e(X, V)),
                    X > w.maxX && (w.maxX = X),
                    X < w.minX && (w.minX = X),
                    V > w.maxY && (w.maxY = V),
                    V < w.minY && (w.minY = V),
                    w.len++,
                    (X += N),
                    (V += T),
                    (w.area -= X * T),
                    !(X === Y.x && V === Y.y);

            ) {
                var dt = M.at(X + (N + T - 1) / 2, V + (T - N - 1) / 2),
                    et = M.at(X + (N - T - 1) / 2, V + (T + N - 1) / 2);
                et && !dt
                    ? J.turnpolicy === "right" ||
                      (J.turnpolicy === "black" && w.sign === "+") ||
                      (J.turnpolicy === "white" && w.sign === "-") ||
                      (J.turnpolicy === "majority" && S(X, V)) ||
                      (J.turnpolicy === "minority" && !S(X, V))
                        ? ((lt = N), (N = -T), (T = lt))
                        : ((lt = N), (N = T), (T = -lt))
                    : et
                      ? ((lt = N), (N = -T), (T = lt))
                      : dt || ((lt = N), (N = T), (T = -lt));
            }
            return w;
        }
        function nt(Y) {
            var w = Y.pt[0].y,
                X = Y.len,
                V,
                N,
                T,
                lt,
                dt,
                et;
            for (dt = 1; dt < X; dt++)
                if (((V = Y.pt[dt].x), (N = Y.pt[dt].y), N !== w)) {
                    for (lt = w < N ? w : N, T = Y.maxX, et = V; et < T; et++) M.flip(et, lt);
                    w = N;
                }
        }
        for (; (I = k(I)); ) (i = D(I)), nt(i), i.area > J.turdsize && U.push(i);
    }
    function W() {
        function M() {
            this.data = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        M.prototype.at = function (s, h) {
            return this.data[s * 3 + h];
        };
        function I(s, h, o, l, a) {
            (this.x = s), (this.y = h), (this.xy = o), (this.x2 = l), (this.y2 = a);
        }
        function i(s, h) {
            return s >= h ? s % h : s >= 0 ? s : h - 1 - ((-1 - s) % h);
        }
        function k(s, h) {
            return s.x * h.y - s.y * h.x;
        }
        function S(s, h, o) {
            return s <= o ? s <= h && h < o : s <= h || h < o;
        }
        function D(s) {
            return s > 0 ? 1 : s < 0 ? -1 : 0;
        }
        function nt(s, h) {
            var o = new Array(3),
                l,
                a,
                p;
            for (o[0] = h.x, o[1] = h.y, o[2] = 1, p = 0, l = 0; l < 3; l++)
                for (a = 0; a < 3; a++) p += o[l] * s.at(l, a) * o[a];
            return p;
        }
        function Y(s, h, o) {
            var l = new e();
            return (l.x = h.x + s * (o.x - h.x)), (l.y = h.y + s * (o.y - h.y)), l;
        }
        function w(s, h) {
            var o = new e();
            return (o.y = D(h.x - s.x)), (o.x = -D(h.y - s.y)), o;
        }
        function X(s, h) {
            var o = w(s, h);
            return o.y * (h.x - s.x) - o.x * (h.y - s.y);
        }
        function V(s, h, o) {
            var l, a, p, f;
            return (l = h.x - s.x), (a = h.y - s.y), (p = o.x - s.x), (f = o.y - s.y), l * f - p * a;
        }
        function N(s, h, o, l) {
            var a, p, f, y;
            return (a = h.x - s.x), (p = h.y - s.y), (f = l.x - o.x), (y = l.y - o.y), a * y - f * p;
        }
        function T(s, h, o) {
            var l, a, p, f;
            return (l = h.x - s.x), (a = h.y - s.y), (p = o.x - s.x), (f = o.y - s.y), l * p + a * f;
        }
        function lt(s, h, o, l) {
            var a, p, f, y;
            return (a = h.x - s.x), (p = h.y - s.y), (f = l.x - o.x), (y = l.y - o.y), a * f + p * y;
        }
        function dt(s, h) {
            return Math.sqrt((s.x - h.x) * (s.x - h.x) + (s.y - h.y) * (s.y - h.y));
        }
        function et(s, h, o, l, a) {
            var p = 1 - s,
                f = new e();
            return (
                (f.x = p * p * p * h.x + 3 * (p * p * s) * o.x + 3 * (s * s * p) * l.x + s * s * s * a.x),
                (f.y = p * p * p * h.y + 3 * (p * p * s) * o.y + 3 * (s * s * p) * l.y + s * s * s * a.y),
                f
            );
        }
        function ft(s, h, o, l, a, p) {
            var f, y, u, v, _, g, b, E, z, G;
            return (
                (f = N(s, h, a, p)),
                (y = N(h, o, a, p)),
                (u = N(o, l, a, p)),
                (v = f - 2 * y + u),
                (_ = -2 * f + 2 * y),
                (g = f),
                (b = _ * _ - 4 * v * g),
                v === 0 || b < 0
                    ? -1
                    : ((E = Math.sqrt(b)),
                      (z = (-_ + E) / (2 * v)),
                      (G = (-_ - E) / (2 * v)),
                      z >= 0 && z <= 1 ? z : G >= 0 && G <= 1 ? G : -1)
            );
        }
        function xt(s) {
            var h, o, l;
            (s.x0 = s.pt[0].x), (s.y0 = s.pt[0].y), (s.sums = []);
            var a = s.sums;
            for (a.push(new I(0, 0, 0, 0, 0)), h = 0; h < s.len; h++)
                (o = s.pt[h].x - s.x0),
                    (l = s.pt[h].y - s.y0),
                    a.push(new I(a[h].x + o, a[h].y + l, a[h].xy + o * l, a[h].x2 + o * o, a[h].y2 + l * l));
        }
        function rt(s) {
            var h = s.len,
                o = s.pt,
                l,
                a = new Array(h),
                p = new Array(h),
                f = new Array(4);
            s.lon = new Array(h);
            var y = [new e(), new e()],
                u = new e(),
                v = new e(),
                _ = new e(),
                g,
                b,
                E,
                z,
                G,
                $,
                Z,
                O,
                B = 0;
            for (b = h - 1; b >= 0; b--) o[b].x != o[B].x && o[b].y != o[B].y && (B = b + 1), (p[b] = B);
            for (b = h - 1; b >= 0; b--) {
                for (
                    f[0] = f[1] = f[2] = f[3] = 0,
                        l = (3 + 3 * (o[i(b + 1, h)].x - o[b].x) + (o[i(b + 1, h)].y - o[b].y)) / 2,
                        f[l]++,
                        y[0].x = 0,
                        y[0].y = 0,
                        y[1].x = 0,
                        y[1].y = 0,
                        B = p[b],
                        z = b;
                    ;

                ) {
                    if (
                        ((g = 0),
                        (l = (3 + 3 * D(o[B].x - o[z].x) + D(o[B].y - o[z].y)) / 2),
                        f[l]++,
                        f[0] && f[1] && f[2] && f[3])
                    ) {
                        (a[b] = z), (g = 1);
                        break;
                    }
                    if (
                        ((u.x = o[B].x - o[b].x),
                        (u.y = o[B].y - o[b].y),
                        k(y[0], u) < 0 ||
                            k(y[1], u) > 0 ||
                            ((Math.abs(u.x) <= 1 && Math.abs(u.y) <= 1) ||
                                ((v.x = u.x + (u.y >= 0 && (u.y > 0 || u.x < 0) ? 1 : -1)),
                                (v.y = u.y + (u.x <= 0 && (u.x < 0 || u.y < 0) ? 1 : -1)),
                                k(y[0], v) >= 0 && ((y[0].x = v.x), (y[0].y = v.y)),
                                (v.x = u.x + (u.y <= 0 && (u.y < 0 || u.x < 0) ? 1 : -1)),
                                (v.y = u.y + (u.x >= 0 && (u.x > 0 || u.y < 0) ? 1 : -1)),
                                k(y[1], v) <= 0 && ((y[1].x = v.x), (y[1].y = v.y))),
                            (z = B),
                            (B = p[z]),
                            !S(B, b, z)))
                    )
                        break;
                }
                g === 0 &&
                    ((_.x = D(o[B].x - o[z].x)),
                    (_.y = D(o[B].y - o[z].y)),
                    (u.x = o[z].x - o[b].x),
                    (u.y = o[z].y - o[b].y),
                    (G = k(y[0], u)),
                    ($ = k(y[0], _)),
                    (Z = k(y[1], u)),
                    (O = k(y[1], _)),
                    (E = 1e7),
                    $ < 0 && (E = Math.floor(G / -$)),
                    O > 0 && (E = Math.min(E, Math.floor(-Z / O))),
                    (a[b] = i(z + E, h)));
            }
            for (E = a[h - 1], s.lon[h - 1] = E, b = h - 2; b >= 0; b--)
                S(b + 1, a[b], E) && (E = a[b]), (s.lon[b] = E);
            for (b = h - 1; S(i(b + 1, h), E, s.lon[b]); b--) s.lon[b] = E;
        }
        function pt(s) {
            function h($, Z, O) {
                var B = $.len,
                    bt = $.pt,
                    ut = $.sums,
                    Tt,
                    Et,
                    Ft,
                    wt,
                    Gt,
                    Rt,
                    Ht,
                    Nt,
                    Ot,
                    Yt,
                    tt,
                    ct,
                    at,
                    Ct,
                    Zt = 0;
                return (
                    O >= B && ((O -= B), (Zt = 1)),
                    Zt === 0
                        ? ((Tt = ut[O + 1].x - ut[Z].x),
                          (Et = ut[O + 1].y - ut[Z].y),
                          (wt = ut[O + 1].x2 - ut[Z].x2),
                          (Ft = ut[O + 1].xy - ut[Z].xy),
                          (Gt = ut[O + 1].y2 - ut[Z].y2),
                          (Rt = O + 1 - Z))
                        : ((Tt = ut[O + 1].x - ut[Z].x + ut[B].x),
                          (Et = ut[O + 1].y - ut[Z].y + ut[B].y),
                          (wt = ut[O + 1].x2 - ut[Z].x2 + ut[B].x2),
                          (Ft = ut[O + 1].xy - ut[Z].xy + ut[B].xy),
                          (Gt = ut[O + 1].y2 - ut[Z].y2 + ut[B].y2),
                          (Rt = O + 1 - Z + B)),
                    (tt = (bt[Z].x + bt[O].x) / 2 - bt[0].x),
                    (ct = (bt[Z].y + bt[O].y) / 2 - bt[0].y),
                    (Ct = bt[O].x - bt[Z].x),
                    (at = -(bt[O].y - bt[Z].y)),
                    (Ht = (wt - 2 * Tt * tt) / Rt + tt * tt),
                    (Nt = (Ft - Tt * ct - Et * tt) / Rt + tt * ct),
                    (Ot = (Gt - 2 * Et * ct) / Rt + ct * ct),
                    (Yt = at * at * Ht + 2 * at * Ct * Nt + Ct * Ct * Ot),
                    Math.sqrt(Yt)
                );
            }
            var o,
                l,
                a,
                p,
                f = s.len,
                y = new Array(f + 1),
                u = new Array(f + 1),
                v = new Array(f),
                _ = new Array(f + 1),
                g = new Array(f + 1),
                b = new Array(f + 1),
                E,
                z,
                G;
            for (o = 0; o < f; o++)
                (G = i(s.lon[i(o - 1, f)] - 1, f)), G == o && (G = i(o + 1, f)), G < o ? (v[o] = f) : (v[o] = G);
            for (l = 1, o = 0; o < f; o++) for (; l <= v[o]; ) (_[l] = o), l++;
            for (o = 0, l = 0; o < f; l++) (g[l] = o), (o = v[o]);
            for (g[l] = f, a = l, o = f, l = a; l > 0; l--) (b[l] = o), (o = _[o]);
            for (b[0] = 0, y[0] = 0, l = 1; l <= a; l++)
                for (o = b[l]; o <= g[l]; o++) {
                    for (z = -1, p = g[l - 1]; p >= _[o]; p--)
                        (E = h(s, p, o) + y[p]), (z < 0 || E < z) && ((u[o] = p), (z = E));
                    y[o] = z;
                }
            for (s.m = a, s.po = new Array(a), o = f, l = a - 1; o > 0; l--) (o = u[o]), (s.po[l] = o);
        }
        function At(s) {
            function h(Ht, Nt, Ot, Yt, tt) {
                for (var ct = Ht.len, at = Ht.sums, Ct, Zt, Xt, ee, ne, zt, ht, gt, Mt, Dt, Pt, Vt = 0; Ot >= ct; )
                    (Ot -= ct), (Vt += 1);
                for (; Nt >= ct; ) (Nt -= ct), (Vt -= 1);
                for (; Ot < 0; ) (Ot += ct), (Vt -= 1);
                for (; Nt < 0; ) (Nt += ct), (Vt += 1);
                (Ct = at[Ot + 1].x - at[Nt].x + Vt * at[ct].x),
                    (Zt = at[Ot + 1].y - at[Nt].y + Vt * at[ct].y),
                    (Xt = at[Ot + 1].x2 - at[Nt].x2 + Vt * at[ct].x2),
                    (ee = at[Ot + 1].xy - at[Nt].xy + Vt * at[ct].xy),
                    (ne = at[Ot + 1].y2 - at[Nt].y2 + Vt * at[ct].y2),
                    (zt = Ot + 1 - Nt + Vt * ct),
                    (Yt.x = Ct / zt),
                    (Yt.y = Zt / zt),
                    (ht = (Xt - (Ct * Ct) / zt) / zt),
                    (gt = (ee - (Ct * Zt) / zt) / zt),
                    (Mt = (ne - (Zt * Zt) / zt) / zt),
                    (Dt = (ht + Mt + Math.sqrt((ht - Mt) * (ht - Mt) + 4 * gt * gt)) / 2),
                    (ht -= Dt),
                    (Mt -= Dt),
                    Math.abs(ht) >= Math.abs(Mt)
                        ? ((Pt = Math.sqrt(ht * ht + gt * gt)), Pt !== 0 && ((tt.x = -gt / Pt), (tt.y = ht / Pt)))
                        : ((Pt = Math.sqrt(Mt * Mt + gt * gt)), Pt !== 0 && ((tt.x = -Mt / Pt), (tt.y = gt / Pt))),
                    Pt === 0 && (tt.x = tt.y = 0);
            }
            var o = s.m,
                l = s.po,
                a = s.len,
                p = s.pt,
                f = s.x0,
                y = s.y0,
                u = new Array(o),
                v = new Array(o),
                _ = new Array(o),
                g = new Array(3),
                b,
                E,
                z,
                G,
                $,
                Z = new e();
            for (s.curve = new c(o), E = 0; E < o; E++)
                (z = l[i(E + 1, o)]),
                    (z = i(z - l[E], a) + l[E]),
                    (u[E] = new e()),
                    (v[E] = new e()),
                    h(s, l[E], z, u[E], v[E]);
            for (E = 0; E < o; E++)
                if (((_[E] = new M()), (b = v[E].x * v[E].x + v[E].y * v[E].y), b === 0))
                    for (z = 0; z < 3; z++) for (G = 0; G < 3; G++) _[E].data[z * 3 + G] = 0;
                else
                    for (g[0] = v[E].y, g[1] = -v[E].x, g[2] = -g[1] * u[E].y - g[0] * u[E].x, $ = 0; $ < 3; $++)
                        for (G = 0; G < 3; G++) _[E].data[$ * 3 + G] = (g[$] * g[G]) / b;
            var O, B, bt, ut, Tt, Et, Ft, wt, Gt, Rt;
            for (E = 0; E < o; E++) {
                for (
                    O = new M(), B = new e(), Z.x = p[l[E]].x - f, Z.y = p[l[E]].y - y, z = i(E - 1, o), $ = 0;
                    $ < 3;
                    $++
                )
                    for (G = 0; G < 3; G++) O.data[$ * 3 + G] = _[z].at($, G) + _[E].at($, G);
                for (;;) {
                    if (((Tt = O.at(0, 0) * O.at(1, 1) - O.at(0, 1) * O.at(1, 0)), Tt !== 0)) {
                        (B.x = (-O.at(0, 2) * O.at(1, 1) + O.at(1, 2) * O.at(0, 1)) / Tt),
                            (B.y = (O.at(0, 2) * O.at(1, 0) - O.at(1, 2) * O.at(0, 0)) / Tt);
                        break;
                    }
                    for (
                        O.at(0, 0) > O.at(1, 1)
                            ? ((g[0] = -O.at(0, 1)), (g[1] = O.at(0, 0)))
                            : O.at(1, 1)
                              ? ((g[0] = -O.at(1, 1)), (g[1] = O.at(1, 0)))
                              : ((g[0] = 1), (g[1] = 0)),
                            b = g[0] * g[0] + g[1] * g[1],
                            g[2] = -g[1] * Z.y - g[0] * Z.x,
                            $ = 0;
                        $ < 3;
                        $++
                    )
                        for (G = 0; G < 3; G++) O.data[$ * 3 + G] += (g[$] * g[G]) / b;
                }
                if (((bt = Math.abs(B.x - Z.x)), (ut = Math.abs(B.y - Z.y)), bt <= 0.5 && ut <= 0.5)) {
                    s.curve.vertex[E] = new e(B.x + f, B.y + y);
                    continue;
                }
                if (((Et = nt(O, Z)), (wt = Z.x), (Gt = Z.y), O.at(0, 0) !== 0))
                    for (Rt = 0; Rt < 2; Rt++)
                        (B.y = Z.y - 0.5 + Rt),
                            (B.x = -(O.at(0, 1) * B.y + O.at(0, 2)) / O.at(0, 0)),
                            (bt = Math.abs(B.x - Z.x)),
                            (Ft = nt(O, B)),
                            bt <= 0.5 && Ft < Et && ((Et = Ft), (wt = B.x), (Gt = B.y));
                if (O.at(1, 1) !== 0)
                    for (Rt = 0; Rt < 2; Rt++)
                        (B.x = Z.x - 0.5 + Rt),
                            (B.y = -(O.at(1, 0) * B.x + O.at(1, 2)) / O.at(1, 1)),
                            (ut = Math.abs(B.y - Z.y)),
                            (Ft = nt(O, B)),
                            ut <= 0.5 && Ft < Et && ((Et = Ft), (wt = B.x), (Gt = B.y));
                for ($ = 0; $ < 2; $++)
                    for (G = 0; G < 2; G++)
                        (B.x = Z.x - 0.5 + $),
                            (B.y = Z.y - 0.5 + G),
                            (Ft = nt(O, B)),
                            Ft < Et && ((Et = Ft), (wt = B.x), (Gt = B.y));
                s.curve.vertex[E] = new e(wt + f, Gt + y);
            }
        }
        function It(s) {
            var h = s.curve,
                o = h.n,
                l = h.vertex,
                a,
                p,
                f;
            for (a = 0, p = o - 1; a < p; a++, p--) (f = l[a]), (l[a] = l[p]), (l[p] = f);
        }
        function Lt(s) {
            var h = s.curve.n,
                o = s.curve,
                l,
                a,
                p,
                f,
                y,
                u,
                v,
                _,
                g;
            for (l = 0; l < h; l++)
                (a = i(l + 1, h)),
                    (p = i(l + 2, h)),
                    (g = Y(1 / 2, o.vertex[p], o.vertex[a])),
                    (y = X(o.vertex[l], o.vertex[p])),
                    y !== 0
                        ? ((f = V(o.vertex[l], o.vertex[a], o.vertex[p]) / y),
                          (f = Math.abs(f)),
                          (u = f > 1 ? 1 - 1 / f : 0),
                          (u = u / 0.75))
                        : (u = 4 / 3),
                    (o.alpha0[a] = u),
                    u >= J.alphamax
                        ? ((o.tag[a] = "CORNER"), (o.c[3 * a + 1] = o.vertex[a]), (o.c[3 * a + 2] = g))
                        : (u < 0.55 ? (u = 0.55) : u > 1 && (u = 1),
                          (v = Y(0.5 + 0.5 * u, o.vertex[l], o.vertex[a])),
                          (_ = Y(0.5 + 0.5 * u, o.vertex[p], o.vertex[a])),
                          (o.tag[a] = "CURVE"),
                          (o.c[3 * a + 0] = v),
                          (o.c[3 * a + 1] = _),
                          (o.c[3 * a + 2] = g)),
                    (o.alpha[a] = u),
                    (o.beta[a] = 0.5);
            o.alphacurve = 1;
        }
        function C(s) {
            function h() {
                (this.pen = 0), (this.c = [new e(), new e()]), (this.t = 0), (this.s = 0), (this.alpha = 0);
            }
            function o(Ft, wt, Gt, Rt, Ht, Nt, Ot) {
                var Yt = Ft.curve.n,
                    tt = Ft.curve,
                    ct = tt.vertex,
                    at,
                    Ct,
                    Zt,
                    Xt,
                    ee,
                    ne,
                    zt,
                    ht,
                    gt,
                    Mt,
                    Dt,
                    Pt,
                    Vt,
                    oe,
                    ue,
                    Be,
                    Je,
                    De,
                    ge,
                    Ae,
                    Ke,
                    Ue,
                    se;
                if (wt == Gt || ((at = wt), (ee = i(wt + 1, Yt)), (Ct = i(at + 1, Yt)), (Xt = Nt[Ct]), Xt === 0))
                    return 1;
                for (ht = dt(ct[wt], ct[ee]), at = Ct; at != Gt; at = Ct)
                    if (
                        ((Ct = i(at + 1, Yt)),
                        (Zt = i(at + 2, Yt)),
                        Nt[Ct] != Xt ||
                            D(N(ct[wt], ct[ee], ct[Ct], ct[Zt])) != Xt ||
                            lt(ct[wt], ct[ee], ct[Ct], ct[Zt]) < ht * dt(ct[Ct], ct[Zt]) * -0.999847695156)
                    )
                        return 1;
                if (
                    ((Dt = tt.c[i(wt, Yt) * 3 + 2].copy()),
                    (Pt = ct[i(wt + 1, Yt)].copy()),
                    (Vt = ct[i(Gt, Yt)].copy()),
                    (oe = tt.c[i(Gt, Yt) * 3 + 2].copy()),
                    (ne = Ot[Gt] - Ot[wt]),
                    (ne -= V(ct[0], tt.c[wt * 3 + 2], tt.c[Gt * 3 + 2]) / 2),
                    wt >= Gt && (ne += Ot[Yt]),
                    (De = V(Dt, Pt, Vt)),
                    (ge = V(Dt, Pt, oe)),
                    (Ae = V(Dt, Vt, oe)),
                    (Ke = De + Ae - ge),
                    ge == De || ((se = Ae / (Ae - Ke)), (Ue = ge / (ge - De)), (Be = (ge * se) / 2), Be === 0))
                )
                    return 1;
                for (
                    Je = ne / Be,
                        zt = 2 - Math.sqrt(4 - Je / 0.3),
                        Rt.c[0] = Y(se * zt, Dt, Pt),
                        Rt.c[1] = Y(Ue * zt, oe, Vt),
                        Rt.alpha = zt,
                        Rt.t = se,
                        Rt.s = Ue,
                        Pt = Rt.c[0].copy(),
                        Vt = Rt.c[1].copy(),
                        Rt.pen = 0,
                        at = i(wt + 1, Yt);
                    at != Gt;
                    at = Ct
                ) {
                    if (
                        ((Ct = i(at + 1, Yt)),
                        (se = ft(Dt, Pt, Vt, oe, ct[at], ct[Ct])),
                        se < -0.5 ||
                            ((ue = et(se, Dt, Pt, Vt, oe)), (ht = dt(ct[at], ct[Ct])), ht === 0) ||
                            ((gt = V(ct[at], ct[Ct], ue) / ht), Math.abs(gt) > Ht) ||
                            T(ct[at], ct[Ct], ue) < 0 ||
                            T(ct[Ct], ct[at], ue) < 0)
                    )
                        return 1;
                    Rt.pen += gt * gt;
                }
                for (at = wt; at != Gt; at = Ct) {
                    if (
                        ((Ct = i(at + 1, Yt)),
                        (se = ft(Dt, Pt, Vt, oe, tt.c[at * 3 + 2], tt.c[Ct * 3 + 2])),
                        se < -0.5 ||
                            ((ue = et(se, Dt, Pt, Vt, oe)), (ht = dt(tt.c[at * 3 + 2], tt.c[Ct * 3 + 2])), ht === 0) ||
                            ((gt = V(tt.c[at * 3 + 2], tt.c[Ct * 3 + 2], ue) / ht),
                            (Mt = V(tt.c[at * 3 + 2], tt.c[Ct * 3 + 2], ct[Ct]) / ht),
                            (Mt *= 0.75 * tt.alpha[Ct]),
                            Mt < 0 && ((gt = -gt), (Mt = -Mt)),
                            gt < Mt - Ht))
                    )
                        return 1;
                    gt < Mt && (Rt.pen += (gt - Mt) * (gt - Mt));
                }
                return 0;
            }
            var l = s.curve,
                a = l.n,
                p = l.vertex,
                f = new Array(a + 1),
                y = new Array(a + 1),
                u = new Array(a + 1),
                v = new Array(a + 1),
                _,
                g,
                b,
                E,
                z = new h(),
                G,
                $,
                Z,
                O,
                B,
                bt,
                ut,
                Tt = new Array(a),
                Et = new Array(a + 1);
            for (g = 0; g < a; g++)
                l.tag[g] == "CURVE" ? (Tt[g] = D(V(p[i(g - 1, a)], p[g], p[i(g + 1, a)]))) : (Tt[g] = 0);
            for (Z = 0, Et[0] = 0, G = l.vertex[0], g = 0; g < a; g++)
                ($ = i(g + 1, a)),
                    l.tag[$] == "CURVE" &&
                        ((O = l.alpha[$]),
                        (Z += (0.3 * O * (4 - O) * V(l.c[g * 3 + 2], p[$], l.c[$ * 3 + 2])) / 2),
                        (Z += V(G, l.c[g * 3 + 2], l.c[$ * 3 + 2]) / 2)),
                    (Et[g + 1] = Z);
            for (f[0] = -1, y[0] = 0, u[0] = 0, b = 1; b <= a; b++)
                for (
                    f[b] = b - 1, y[b] = y[b - 1], u[b] = u[b - 1] + 1, g = b - 2;
                    g >= 0 && ((E = o(s, g, i(b, a), z, J.opttolerance, Tt, Et)), !E);
                    g--
                )
                    (u[b] > u[g] + 1 || (u[b] == u[g] + 1 && y[b] > y[g] + z.pen)) &&
                        ((f[b] = g), (y[b] = y[g] + z.pen), (u[b] = u[g] + 1), (v[b] = z), (z = new h()));
            for (_ = u[a], B = new c(_), bt = new Array(_), ut = new Array(_), b = a, g = _ - 1; g >= 0; g--)
                f[b] == b - 1
                    ? ((B.tag[g] = l.tag[i(b, a)]),
                      (B.c[g * 3 + 0] = l.c[i(b, a) * 3 + 0]),
                      (B.c[g * 3 + 1] = l.c[i(b, a) * 3 + 1]),
                      (B.c[g * 3 + 2] = l.c[i(b, a) * 3 + 2]),
                      (B.vertex[g] = l.vertex[i(b, a)]),
                      (B.alpha[g] = l.alpha[i(b, a)]),
                      (B.alpha0[g] = l.alpha0[i(b, a)]),
                      (B.beta[g] = l.beta[i(b, a)]),
                      (bt[g] = ut[g] = 1))
                    : ((B.tag[g] = "CURVE"),
                      (B.c[g * 3 + 0] = v[b].c[0]),
                      (B.c[g * 3 + 1] = v[b].c[1]),
                      (B.c[g * 3 + 2] = l.c[i(b, a) * 3 + 2]),
                      (B.vertex[g] = Y(v[b].s, l.c[i(b, a) * 3 + 2], p[i(b, a)])),
                      (B.alpha[g] = v[b].alpha),
                      (B.alpha0[g] = v[b].alpha),
                      (bt[g] = v[b].s),
                      (ut[g] = v[b].t)),
                    (b = f[b]);
            for (g = 0; g < _; g++) ($ = i(g + 1, _)), (B.beta[g] = bt[g] / (bt[g] + ut[$]));
            (B.alphacurve = 1), (s.curve = B);
        }
        for (var P = 0; P < U.length; P++) {
            var A = U[P];
            xt(A), rt(A), pt(A), At(A), A.sign === "-" && It(A), Lt(A), J.optcurve && C(A);
        }
    }
    function K(M) {
        if ((M && (H = M), !J.isReady)) {
            setTimeout(K, 100);
            return;
        }
        st(), W(), H(), (H = null);
    }
    function Q() {
        (F = null), (U = []), (H = null), (J.isReady = !1);
    }
    function it(M, I) {
        function i(T) {
            function lt(rt) {
                var pt = "C " + (T.c[rt * 3 + 0].x * M).toFixed(3) + " " + (T.c[rt * 3 + 0].y * M).toFixed(3) + ",";
                return (
                    (pt += (T.c[rt * 3 + 1].x * M).toFixed(3) + " " + (T.c[rt * 3 + 1].y * M).toFixed(3) + ","),
                    (pt += (T.c[rt * 3 + 2].x * M).toFixed(3) + " " + (T.c[rt * 3 + 2].y * M).toFixed(3) + " "),
                    pt
                );
            }
            function dt(rt) {
                var pt = "L " + (T.c[rt * 3 + 1].x * M).toFixed(3) + " " + (T.c[rt * 3 + 1].y * M).toFixed(3) + " ";
                return (pt += (T.c[rt * 3 + 2].x * M).toFixed(3) + " " + (T.c[rt * 3 + 2].y * M).toFixed(3) + " "), pt;
            }
            var et = T.n,
                ft,
                xt =
                    "M" +
                    (T.c[(et - 1) * 3 + 2].x * M).toFixed(3) +
                    " " +
                    (T.c[(et - 1) * 3 + 2].y * M).toFixed(3) +
                    " ";
            for (ft = 0; ft < et; ft++)
                T.tag[ft] === "CURVE" ? (xt += lt(ft)) : T.tag[ft] === "CORNER" && (xt += dt(ft));
            return xt;
        }
        var k = F.w * M,
            S = F.h * M,
            D = U.length,
            nt,
            Y,
            w,
            X,
            V,
            N = '<svg id="svg" version="1.1" width="' + k + '" height="' + S + '" xmlns="http://www.w3.org/2000/svg">';
        for (N += '<path d="', Y = 0; Y < D; Y++) (nt = U[Y].curve), (N += i(nt));
        return (
            I === "curve"
                ? ((w = "black"), (X = "none"), (V = ""))
                : ((w = "none"), (X = "black"), (V = ' fill-rule="evenodd"')),
            (N += '" stroke="' + w + '" fill="' + X + '"' + V + "/></svg>"),
            N
        );
    }
    return {
        loadImageFromFile: yt,
        loadImageFromUrl: vt,
        setParameter: St,
        process: K,
        getSVG: it,
        setImg: ot,
        setImg: ot,
        onImgLoaded: L,
        img: m,
    };
};
const re = (e, n) => {
        const r = e[0],
            c = e[1];
        let m = !1;
        for (let R = 0, F = n.length - 2; R < n.length; F = R, R += 2) {
            const U = n[R],
                H = n[R + 1],
                J = n[F],
                L = n[F + 1];
            H > c != L > c && r < ((J - U) * (c - H)) / (L - H) + U && (m = !m);
        }
        return m;
    },
    sn = (e) => {
        if (e.length === 0)
            return console.warn("[geom-utils:computeBoundingBox] No points to compute bounding box"), null;
        const n = (L) => (Array.isArray(L) ? L[0] : L.x),
            r = (L) => (Array.isArray(L) ? L[1] : L.y);
        let c = n(e[0]),
            m = r(e[0]),
            R = n(e[0]),
            F = r(e[0]);
        e.forEach((L) => {
            const yt = n(L),
                vt = r(L);
            yt < c && (c = yt), yt > R && (R = yt), vt < m && (m = vt), vt > F && (F = vt);
        });
        const U = R - c,
            H = F - m,
            J = U * H || 0.01;
        return { minX: c, maxX: R, minY: m, maxY: F, area: J };
    },
    ln = (e) => {
        let n = 0;
        for (let r = 0; r < e.length; r += 2) {
            const c = (r + 2) % e.length;
            (n += e[r] * e[c + 1]), (n -= e[r + 1] * e[c]);
        }
        return Math.abs(n) / 2;
    },
    To = ["green", "purple", "#F48484", "brown", "#00337C", "orange"];
let rn = null,
    ae = null,
    Go = null;
const cn = ["color"],
    an = [],
    Oe = [],
    Ee = 1,
    Bo = () => {
        let e = d.dimensions.base[0],
            n = d.dimensions.base[1],
            r = [],
            c = [];
        const m = (j) => {
                (rn = j), F();
            },
            R = () => L("color").cvs,
            F = () => {
                const j = new Lo();
                j.setImg(rn),
                    j.onImgLoaded(),
                    j.process(function () {
                        const st = j.getSVG(1);
                        (ae = new DOMParser().parseFromString(st, "image/svg+xml").querySelector("svg")),
                            document.body.appendChild(ae),
                            (ae.style.visibility = "hidden"),
                            (ae.style.position = "absolute"),
                            (ae.style.top = ae.style.left = "0px"),
                            U();
                    });
            },
            U = () => {
                H(), J(), vt();
            },
            H = () => {
                const j = ae.querySelector("path");
                j.getBoundingClientRect();
                const st = j.getAttribute("d") + "",
                    W = [...st.matchAll(new RegExp("M", "gi"))].map((K) => K.index);
                for (let K = 0; K < W.length; K++) {
                    const Q = st.substring(W[K], W[K + 1]),
                        it = t.pick(To),
                        M = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    M.setAttributeNS(null, "d", Q),
                        M.setAttributeNS(null, "fill", it),
                        M.setAttributeNS(null, "fill-rull", "even-odd"),
                        M.setAttributeNS(null, "stroke", "none");
                    let I = 0;
                    const i = {
                            path: M,
                            color: it,
                            points: [],
                            area: 0,
                            bounds: { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 },
                        },
                        k = M.getTotalLength();
                    let S = d.rough ? t.pick([60, 100, 150]) : 5,
                        D = t.pick(d.geomOffset.normOffsetOpts);
                    for (let Y = 0; Y < k - S; Y += S) {
                        const w = M.getPointAtLength(Y),
                            X = M.getPointAtLength(Y + S);
                        (w.x *= Ee), (w.y *= Ee), (X.x *= Ee), (X.y *= Ee);
                        const V = X.x - w.x,
                            N = X.y - w.y,
                            T = Math.atan2(N, V),
                            lt = T + Math.PI / 2,
                            dt = w.x / e,
                            et = w.y / n,
                            ft = d.geomOffset.noiseScl,
                            xt = d.geomOffset.noiseAmp,
                            rt = 10,
                            pt = t.n2D(dt * ft * 2 + K, et * ft * 2 + K),
                            At = rt * pt,
                            It = K * 10;
                        let Lt = Math.round((t.n2D(dt * ft + It, et * ft + It) * xt) / At) * At;
                        const C = D + Lt || 0;
                        (w.x += Math.cos(lt) * C),
                            (w.y += Math.sin(lt) * C),
                            (i.bounds.minX = Math.min(i.bounds.minX, w.x)),
                            (i.bounds.minY = Math.min(i.bounds.minY, w.y)),
                            (i.bounds.maxX = Math.max(i.bounds.maxX, w.x)),
                            (i.bounds.maxY = Math.max(i.bounds.maxY, w.y));
                        const P = { pt: w, a: T, color: it, islandIdx: K };
                        i.points.push(P);
                    }
                    if (
                        ((i.bounds.width = i.bounds.maxX - i.bounds.minX),
                        (i.bounds.height = i.bounds.maxY - i.bounds.minY),
                        (i.bounds.diag = Math.sqrt(
                            i.bounds.width * i.bounds.width + i.bounds.height * i.bounds.height
                        )),
                        i.points.length > 0)
                    ) {
                        for (let X = 0; X < i.points.length; X++) {
                            const V = i.points[X].pt,
                                N = i.points[(X + 1) % i.points.length].pt;
                            I += V.x * N.y - N.x * V.y;
                        }
                        i.area = Math.abs(I / 2);
                        let Y = 0,
                            w = 0;
                        i.points.forEach((X) => {
                            (Y += X.pt.x), (w += X.pt.y);
                        }),
                            (i.center = { x: Y / i.points.length, y: w / i.points.length });
                    }
                    let nt = !1;
                    for (const Y of c)
                        if (re([i.center.x, i.center.y], Y.flatPoints)) {
                            nt = !0;
                            break;
                        }
                    if (i.bounds.diag < 100) {
                        if (!d.smalls && !nt) continue;
                        const Y = -1;
                        i.points.forEach((w, X) => {
                            const V = w.pt.x / e,
                                N = w.pt.y / n,
                                T = t.range(1, 3),
                                lt = 5,
                                dt = t.n2D(V * T * 2 + X, N * T * 2 + X),
                                et = Y * dt;
                            Math.round((t.n2D(V * T + X, N * T + X) * lt) / et) * et, w.a + Math.PI / 2;
                        });
                    }
                    Oe.push(i);
                }
                Oe.length < 45 && (d.press = 1);
            },
            J = () => {
                const j = e,
                    st = n;
                for (let W = 0; W < cn.length; W++) {
                    const K = cn[W],
                        Q = document.createElement("canvas"),
                        it = Q.getContext("2d");
                    (Q.style.width = `${j * d.dimensions.debugScl}px`),
                        (Q.style.height = `${st * d.dimensions.debugScl}px`),
                        (Q.width = j),
                        (Q.height = st),
                        an.push({ id: K, cvs: Q, ctx: it });
                }
            },
            L = (j) => {
                const st = an.find((W) => W.id == j);
                if (!st) {
                    console.error("[Tracer _getCanvasById] no canvas found for id", j);
                    return;
                }
                return st;
            },
            yt = () => {
                const { ctx: j, cvs: st } = L("color");
                j.save(),
                    (j.fillStyle = "black"),
                    (j.strokeStyle = "black"),
                    (j.lineWidth = 2),
                    Oe.forEach((W) => {
                        W.color;
                        const K = W.points;
                        if (K.length !== 0) {
                            j.beginPath(), j.moveTo(K[0].pt.x, K[0].pt.y);
                            for (let Q = 1; Q < K.length; Q++) {
                                const it = K[Q].pt;
                                j.lineTo(it.x, it.y);
                            }
                            j.closePath(), j.stroke();
                        }
                    }),
                    j.restore();
            },
            vt = () => {
                const { cvs: j, ctx: st } = L("color");
                st.clearRect(0, 0, e, n), (st.fillStyle = "#F48484"), st.fillRect(0, 0, e, n), yt();
            };
        return {
            fromImage: m,
            getColor: R,
            getGeoms: () => Oe,
            getCanvas: () => Go,
            setBaseShapes: (j) => {
                r = j;
                for (let st = 0; st < r.length; st++) {
                    const W = r[st];
                    if (W.func == x.ROTATEDGRID) {
                        const K = [];
                        for (let Q = 0; Q < W.points.length; Q++) {
                            const it = W.points[Q];
                            K.push(it.x, it.y);
                        }
                        (W.flatPoints = K), c.push(W);
                    }
                }
            },
        };
    };
let Uo = () => ({
    emit(e, ...n) {
        let r = this.events[e] || [];
        for (let c = 0, m = r.length; c < m; c++) r[c](...n);
    },
    events: {},
    on(e, n) {
        return (
            this.events[e]?.push(n) || (this.events[e] = [n]),
            () => {
                this.events[e] = this.events[e]?.filter((r) => n !== r);
            }
        );
    },
});
const Tn = Uo(),
    Gn = { RENDER_COMPLETE: "render_complete" };
let ye = [];
const Xo = () => {
    let e = d.dimensions.base[0],
        n = d.dimensions.base[1],
        r = null,
        c = null,
        m = null,
        R = null,
        F = 0,
        U = 5;
    const H = () => {
            (r = document.createElement("canvas")),
                (r.width = e),
                (r.height = n),
                (r.id = "colorize"),
                (c = r.getContext("2d")),
                (m = document.createElement("canvas")),
                (m.width = d.dimensions.final[0]),
                (m.height = d.dimensions.final[1]),
                (m.id = "artwork"),
                (R = m.getContext("2d"));
            const st = d.dimensions.final[0] / d.dimensions.final[1],
                W = 20,
                K = window.innerWidth - W,
                Q = window.innerHeight - W;
            let it = Math.min(d.dimensions.final[0], K),
                M = it / st;
            M > Q && ((M = Q), (it = M * st)),
                (m.style.width = `${it}px`),
                (m.style.height = `${M}px`),
                (m.style.position = "absolute"),
                (m.style.left = "50%"),
                (m.style.top = "50%"),
                (m.style.transform = "translate(-50%, -50%)"),
                (m.style.border = "none");
        },
        J = () => {
            F += U;
        },
        L = () => {
            F <= U && (c.clearRect(0, 0, e, n), (c.fillStyle = d.backgroundColor), c.fillRect(0, 0, e, n));
            const st = F,
                W = Math.min(ye.length - 1, F + U);
            for (let K = st; K <= W; K++) {
                const Q = ye[K];
                c.save(), (c.lineJoin = "round");
                let it = 5;
                d.density == "l" && (it = 8),
                    (c.globalAlpha = Q.style.opacity * it),
                    (c.lineWidth = Q.style.strokeWidth * 2),
                    (c.strokeStyle = Q.style.strokeColor),
                    (c.fillStyle = Q.style.strokeColor),
                    (c.globalCompositeOperation = Q.style.blendingMode);
                const M = Q.path.split(" "),
                    I = M[0].slice(1).split(",").map(Number);
                c.beginPath(), c.moveTo(I[0], I[1]);
                for (let i = 1; i < M.length; i++) {
                    const k = M[i].slice(1).split(",").map(Number);
                    c.lineTo(k[0], k[1]);
                }
                c.stroke(), c.restore();
            }
        },
        yt = () => {
            R.clearRect(0, 0, m.width, m.height),
                (R.fillStyle = d.backgroundColor),
                R.drawImage(r, 0, 0, m.width, m.height);
        },
        vt = () => {
            J(), L(), yt(), F < ye.length && requestAnimationFrame(vt), F >= ye.length && Tn.emit(Gn.RENDER_COMPLETE);
        },
        St = () => r,
        ot = () => m,
        mt = (st) => {
            (ye = st.strokesData), st.strokePoints;
            let W = d.density == "h" ? 90 : 270,
                K = d.density == "h" ? 0.5 : 1;
            U = Math.ceil((ye.length / W) * K);
        },
        j = (st) => {};
    return H(), { setRawIslandsData: j, setStrokesData: mt, play: vt, getCanvas: St, getFinalCanvas: ot };
};
let hn = [],
    he = [];
const Vo = () => {
    let e = d.dimensions.base[0],
        n = d.dimensions.base[1],
        r = null,
        c = null;
    const m = (St) => {
            (hn = St), F();
        },
        R = () => r,
        F = () => {
            (he = []),
                hn.forEach((St) => {
                    const ot = St.points;
                    for (let mt = 0; mt < ot.length; mt++) {
                        const j = ot[mt],
                            st = ot[mt + 1] || ot[0],
                            W = { x: st.pt.x - j.pt.x, y: st.pt.y - j.pt.y },
                            K = Math.sqrt(W.x * W.x + W.y * W.y);
                        (W.x /= K), (W.y /= K), he.push({ x: j.pt.x, y: j.pt.y, tangent: W });
                    }
                });
        },
        U = () => {
            (r = document.createElement("canvas")),
                (r.width = e),
                (r.height = n),
                (r.style.width = `${e * 0.5}px`),
                (r.style.height = `${n * 0.5}px`),
                (r.id = "flow"),
                (c = r.getContext("2d"));
        },
        H = () => {
            c.clearRect(0, 0, e, n), (c.fillStyle = "white"), c.fillRect(0, 0, e, n);
            for (let St = 0; St < he.length; St++) {
                const ot = he[St],
                    mt = ot.tangent;
                c.save(),
                    (c.fillStyle = "black"),
                    c.translate(ot.x, ot.y),
                    c.beginPath(),
                    c.arc(0, 0, 2, 0, Math.PI * 2),
                    c.closePath(),
                    c.fill(),
                    c.restore(),
                    c.save(),
                    (c.strokeStyle = "red"),
                    c.translate(ot.x, ot.y),
                    c.beginPath(),
                    c.moveTo(0, 0),
                    c.lineTo(mt.x * 30, mt.y * 30),
                    c.stroke(),
                    c.restore();
            }
        },
        J = () => {
            H();
        },
        L = (St, ot) => {
            let mt = null,
                j = 1 / 0;
            return (
                he.forEach((st) => {
                    const W = st.x - St,
                        K = st.y - ot,
                        Q = W * W + K * K;
                    Q < j && ((j = Q), (mt = st));
                }),
                mt ? j : 0
            );
        },
        yt = (St, ot, mt = 1, j = 1 / 0) => {
            let W = Array(mt)
                .fill()
                .map(() => ({ point: null, distance: 1 / 0 }));
            if (
                (he.forEach((I) => {
                    const i = I.x - St,
                        k = I.y - ot,
                        S = i * i + k * k;
                    if (!(S > j * j)) {
                        for (let D = 0; D < W.length; D++)
                            if (S < W[D].distance) {
                                for (let nt = W.length - 1; nt > D; nt--) W[nt] = { ...W[nt - 1] };
                                W[D] = { point: I, distance: S };
                                break;
                            }
                    }
                }),
                !W[0].point)
            )
                return null;
            const K = W.filter((I) => I.point !== null).length;
            if (K === 1) return W[0].point.tangent;
            const Q = { x: 0, y: 0 };
            let it = 0;
            for (let I = 0; I < K; I++) {
                const i = 1 / (W[I].distance + 1e-4);
                (it += i), (Q.x += W[I].point.tangent.x * i), (Q.y += W[I].point.tangent.y * i);
            }
            (Q.x /= it), (Q.y /= it);
            const M = Math.sqrt(Q.x * Q.x + Q.y * Q.y);
            return (Q.x /= M), (Q.y /= M), Q;
        },
        vt = () => he;
    return (
        U(),
        {
            getCanvas: R,
            getPoints: vt,
            getTangentAtPosition: yt,
            getDistanceFromGeomAtPosition: L,
            setGeoms: m,
            render: J,
        }
    );
};
let pe = [],
    te = [],
    me = [],
    be = [],
    Pe = [],
    le = [],
    Ye = [],
    Qt = d.palette,
    fn = d.tangentModeOpts;
const Yo = () => {
    let e = 0,
        n = d.dimensions.base[0],
        r = d.dimensions.base[1] - e;
    const c = n / r;
    let m = null,
        R = [];
    t.int(0, Qt.length - 1);
    const F = t.pick($e),
        U = 0.005 * n,
        H = (I) => {
            const i = I.min.x + I.dimensions.width / 2,
                k = I.min.y + I.dimensions.height / 2,
                S = Math.sqrt(Math.pow(I.dimensions.width / 2, 2) + Math.pow(I.dimensions.height / 2, 2));
            return { center: { x: i, y: k }, radius: S };
        },
        J = (I, i, k) => {
            let S = !1;
            for (let D = 0; D < le.length; D++) {
                const nt = le[D].points;
                re([I, i], nt) && (S = !0);
            }
            return !S;
        },
        L = (I, i) => {
            let k = !1;
            for (let S = 0; S < Ye.length; S++) {
                const D = Ye[S];
                !d.lightSides.includes(D.side) || (re([I, i], D.points) && (k = !0));
            }
            return k;
        },
        yt = () => {
            for (let I = 0; I < me.length; I++) {
                const i = me[I],
                    k = i.x,
                    S = i.y;
                k + i.tangent.x * i.tangentScl, S + i.tangent.y * i.tangentScl;
                const D = i.geomIdx,
                    nt = i.geom ? i.geom : pe[D],
                    Y = i.isInBackground,
                    w = i.isFirstGeom,
                    X = nt.points;
                i.fillProgress;
                const V = i.fuziness || 1,
                    N = { x: -i.tangent.y, y: i.tangent.x };
                let T = `M${k},${S}`;
                const lt = t.int(5, 15),
                    dt = t.range(0.001, 0.003) * n,
                    et = t.range(-0.3, 0.3) * i.tangentScl * 0.3;
                for (let pt = 0; pt < lt; pt++) {
                    const At = pt / lt;
                    let It = k + i.tangent.x * i.tangentScl * At,
                        Lt = S + i.tangent.y * i.tangentScl * At;
                    const C = Math.sin(At * Math.PI) * et;
                    (It += N.x * C), (Lt += N.y * C);
                    let P = It / n,
                        A = Lt / r;
                    const s = 0.004,
                        h = (At + t.random()) % 1,
                        o = t.n2D(h + P * s, h + A * s),
                        l = t.n2D(h + P * s + 50, h + A * s + 50);
                    (It += N.x * o * dt),
                        (Lt += N.y * l * dt),
                        !!re([It, Lt], X) && It > U && It < n - U && Lt > U && Lt < r - U && (T += ` L${It},${Lt}`);
                }
                let ft = Bt(t.n2D((k / n) * 3, (S / r) * 3), -1, 1, 1, 10);
                d.density == "h" && (ft = 3);
                let xt = Bt(t.n2D((k / n) * 2, (S / r) * 2), -1, 1, 1, ft),
                    rt = i.tangentScl * Bt(Math.abs(t.n2D((k / n) * 1.5 + 60, (S / r) * 1.5 + 60)), -1, 1, 0.01, 0.05);
                Y && (rt *= t.range(0.2, 0.4)),
                    t.bool(0.2) && (rt *= d.baseEllipseWidthScl),
                    t.bool(0.2) && (rt *= 2),
                    d.isLandscape && S / r > 0.7 && ((xt = 1), (rt *= 0.5));
                for (let pt = 0; pt < xt; pt++) {
                    const At = k / n,
                        It = S / r,
                        Lt = pt * i.thickness * Bt(t.n2D(At * 0.7 + 1e3 + pt, It * 0.7 + 1e3 + pt), -1, 1, 0.2, 1),
                        C = t.range(-0.005, 0.005) * n,
                        P = t.range(-0.005, 0.005) * r;
                    t.int(50, 50);
                    const A = t.range(rt * 0.5, rt * 2),
                        s = i.tangentScl * Bt(t.n2D(At * 1.3 + 50, It * 1.3 + 50), -1, 1, 0.1, 1);
                    Math.PI * t.range(0.1, 2);
                    const h = t.random() * Math.PI,
                        o = t.range(h, Math.PI),
                        l = t.range(0.05, 0.1);
                    let a = t.range(0.005, 0.008) * n;
                    const p = t.range(-0.1, 0.1) * i.tangentScl * 0;
                    for (let f = h; f <= o; f += l) {
                        let y = Math.cos(f * Math.PI * 2) * A + N.x * f * 5,
                            u = Math.sin(f * Math.PI * 2) * s + N.y * f * 5;
                        const v = (f - h) / (o - h),
                            _ = Math.sin(v * Math.PI) * p;
                        (y += N.x * _), (u += N.y * _);
                        let g = Math.atan2(i.tangent.y, i.tangent.x) + Math.PI / 2 + t.range(-0.1, 0.1) * V;
                        const b = y * Math.cos(g) - u * Math.sin(g),
                            E = y * Math.sin(g) + u * Math.cos(g);
                        (y = b + k),
                            (u = E + S),
                            (y += N.x * Lt * t.range(0.5, 1)),
                            (u += N.y * Lt * t.range(0.5, 1)),
                            (y += C),
                            (u += P),
                            (y += t.n2D(At * 1e3, It * 1e3) * a),
                            (u += t.n2D(At * 1e3 + 500, It * 1e3 + 500) * a),
                            re([y, u], X) && (y < U || y > n - U || u < U || u > r - U || (T += ` L${y},${u}`));
                    }
                }
                be.push({
                    path: T,
                    geom: nt,
                    style: {
                        opacity: i.opacity,
                        strokeWidth: i.thickness,
                        strokeColor: i.color,
                        strokeMixedColor: i.mixedColor,
                        blendingMode: i.blendingMode,
                    },
                    info: {
                        layer: "main",
                        isInBackground: Y,
                        isFirstGeom: w,
                        brushType: "crayon",
                        isOtherColor: i.isOtherColor,
                    },
                });
            }
        },
        vt = () => {
            const I = Pe;
            for (let i = 0; i < I.length; i++) {
                const k = I[i],
                    S = k.points,
                    D = ot(le[i]).contour;
                if (D.skip) continue;
                const nt = D.opacity,
                    Y = D.strokeWidth;
                let w = `M${S[0].x},${S[0].y}`;
                for (let X = 1; X < S.length; X++) {
                    let V = S[X].x,
                        N = S[X].y;
                    (V += t.range(-1, 1) * 0.001 * n),
                        (N += t.range(-1, 1) * 0.001 * r),
                        !(V < 0 || V > n || N < 0 || N > r) && (w += ` L${V},${N}`);
                }
                be.push({
                    path: w,
                    geom: k,
                    style: {
                        opacity: nt,
                        strokeWidth: Y,
                        strokeColor: "#111111",
                        strokeMixedColor: "#111111",
                        blendingMode: "multiply",
                    },
                    info: { layer: "contour", isInBackground: !1, isFirstGeom: !1, brushType: "crayon", isContour: !0 },
                });
            }
        },
        St = () => {
            if (d.rough || !d.vstrokes || (d.density !== "h" && d.comps.length == 1 && d.comps[0] == x.GRIBOUILLIS))
                return;
            const I = te;
            let i = 5;
            i = 5;
            let k = d.density == "l" ? 0.01 : 0.04;
            d.tScl < 0.6 && (k *= 0.3);
            for (let S = 0; S < I.length; S++) {
                const D = I[S];
                D.points;
                const nt = S == 0;
                if (nt || !D.isFilled) continue;
                const Y = D.color,
                    w = D.bb.dimensions.width,
                    X = D.bb.dimensions.height;
                if (!(w > n / 1.5 && X > r / 1.5 && nt))
                    for (let V = D.bb.min.x; V <= D.bb.max.x; V += i) {
                        let N = [],
                            T = [];
                        const lt = t.range(-i, i) * 0.1,
                            dt = t.range(-i, i) * 0.1;
                        for (let et = D.bb.min.y; et <= D.bb.max.y; et += 1) {
                            let ft = J(V, et);
                            pe.length > 1 && (ft = !1);
                            let xt = L(V, et) && d.light;
                            if (re([V, et], D.points) && !ft) {
                                const rt = V + lt,
                                    pt = et + dt;
                                if (rt < U || rt > n - U || pt < U || pt > r - U || xt) continue;
                                T.length === 0 || Math.abs(pt - T[T.length - 1][1]) <= 1
                                    ? T.push([rt, pt])
                                    : (T.length > 0 && N.push([...T]), (T = [[rt, pt]]));
                            }
                        }
                        T.length > 0 && N.push(T),
                            N.forEach((et) => {
                                if (et.length > 1) {
                                    let ft = `M${et[0][0]},${et[0][1]}`;
                                    for (let xt = 1; xt < et.length; xt++) ft += ` L${et[xt][0]},${et[xt][1]}`;
                                    be.push({
                                        path: ft,
                                        geom: D,
                                        style: {
                                            opacity: k,
                                            strokeWidth: 0.5,
                                            strokeColor: Y,
                                            strokeMixedColor: Y,
                                            blendingMode: "multiply",
                                        },
                                        info: {
                                            layer: "texture",
                                            isInBackground: !1,
                                            isFirstGeom: !1,
                                            brushType: "crayon",
                                            isContour: !1,
                                            isTextureStroke: !0,
                                        },
                                    });
                                }
                            });
                    }
            }
        },
        ot = (I) => {
            let i = null,
                k = 1 / 0,
                S = R[0];
            return (
                R.forEach((D) => {
                    const nt = I.bb.center.x - D.x,
                        Y = I.bb.center.y - D.y,
                        w = Math.sqrt(nt * nt + Y * Y);
                    w < k && ((k = w), (i = D));
                }),
                i && (S = i),
                S
            );
        },
        mt = () => {
            if (!t.bool(d.sim)) return;
            const I = le;
            let i = 0;
            (i = 0.5),
                I.forEach((k, S) => {
                    k.bb.dimensions.width, k.bb.dimensions.height, k.bb.center.x, k.bb.center.y, ln(k.points);
                    const D = H(k.bb);
                    let nt = k.color;
                    const Y = 10;
                    if (!t.bool(0.5))
                        for (let X = 0; X < Y; X++) {
                            const V = t.range(k.bb.min.x, k.bb.max.x),
                                N = t.range(k.bb.min.y, k.bb.max.y);
                            let T = { x: V, y: N },
                                lt = `M${T.x},${T.y}`;
                            for (let xt = 0; xt < 40; xt++) {
                                const rt = m.getTangentAtPosition(T.x, T.y, 1, D.radius);
                                if (!re([T.x, T.y], k.points)) {
                                    (T.x = t.range(k.bb.min.x, k.bb.max.x)),
                                        (T.y = t.range(k.bb.min.y, k.bb.max.y)),
                                        (lt = `M${T.x},${T.y}`);
                                    continue;
                                }
                                if (!rt?.x || !rt?.y) continue;
                                (rt.x *= t.range(0.2, 2)), (rt.y *= t.range(0.2, 2));
                                let pt = 10;
                                (T.x += rt.x * pt), (T.y += rt.y * pt), (lt += ` L${T.x},${T.y}`);
                            }
                            let dt = t.range(0.05, 0.15) * i,
                                et = t.range(0.1, 0.3) * 1.5,
                                ft = t.bool(0.5) ? "multiply" : "source-over";
                            be.push({
                                path: lt,
                                geom: k,
                                style: {
                                    opacity: dt,
                                    strokeWidth: et,
                                    strokeColor: nt,
                                    strokeMixedColor: nt,
                                    blendingMode: ft,
                                },
                                info: {
                                    layer: "sim",
                                    isInBackground: !1,
                                    isFirstGeom: !1,
                                    brushType: "crayon",
                                    isOtherColor: !1,
                                },
                            });
                        }
                });
        },
        j = (I) => {
            const i = I == "c" ? te : le,
                k = d.layers.length > 1 && I == "c" ? d.neg : 0;
            i.forEach((S, D) => {
                const nt = [],
                    Y = D;
                let w = D == 0;
                const X = me.length,
                    V = t.pick(["c", "v", "h", "n"]);
                let N = d.density;
                if ((d.layers.length > 1 && I == "c" && (N = "h"), D / i.length, !S.isFilled || t.bool(k))) return;
                const lt = S.bb.dimensions.width,
                    dt = S.bb.dimensions.height,
                    et = S.bb.center.x,
                    ft = S.bb.center.y;
                ln(S.points);
                let xt = Math.sqrt(lt * lt + dt * dt);
                if (lt > n / 1.5 && dt > r / 1.5 && w) return;
                let rt = w ? F : S.color,
                    pt = w ? F : t.pick(Qt);
                d.colorrep == "n" &&
                    (pt =
                        Qt[
                            ~~Bt(
                                t.n2D((S.bb.center.x / n) * 1 * c + D, (S.bb.center.y / r) * 1 + D),
                                -1,
                                1,
                                0,
                                Qt.length - 1
                            )
                        ]);
                let At = 0.015;
                N == "l"
                    ? (At *= n * 1.2)
                    : N == "m"
                      ? (At *= n * 0.8 * t.range(0.75, 1))
                      : N == "h" && (At *= n * 0.25 * t.range(1, 1)),
                    N !== "h" && d.tScl == 1 && (At *= 1.3);
                let It = [],
                    Lt = 0;
                if (d.density !== "h") {
                    It = new Ln({ shape: [lt, dt], radius: At, tries: 20 }, t.random.bind(t));
                    var C = It.fill();
                    Lt = C.length;
                }
                let P = d.gridSpacing;
                xt < 100 && (P = 1.5), t.n2D(et, ft) < 0.2;
                const A = Math.ceil(lt / P),
                    s = Math.ceil(dt / P);
                d.density == "h" && (Lt = A * s);
                let h = rt == "#000000" ? 0 : t.range(d.othercolor * 0.8, d.othercolor * 1.2),
                    o = t.range(0.05, 0.25) * 0,
                    l = t.bool(o),
                    a = !0,
                    p = t.bool(d.contained);
                const f = t.range(0.05, 0.15),
                    y = t.bool(d.gradient),
                    u = t.bool(0.5) ? 0 : t.range(-0.1, 0.1) * 0,
                    v = t.pick(d.fuzinessOpts),
                    _ = t.range(-0.2, 0.2) * 0.1;
                let g = t.random() * 10,
                    b = !1,
                    E = t.range(0.07, 0.2);
                d.tangentModeOpts.length == 1 &&
                    (d.tangentModeOpts[0] == "n" || d.tangentModeOpts[0] == "c") &&
                    (b = t.bool(0.5));
                for (let z = 0; z < Lt; z++) {
                    let G = 0,
                        $ = 0;
                    const Z = z % A,
                        O = Math.floor(z / A);
                    d.density !== "h"
                        ? ((G = C[z][0] + S.bb.min.x), ($ = C[z][1] + S.bb.min.y))
                        : ((G = S.bb.min.x + Z * P), ($ = S.bb.min.y + O * P));
                    let B = G / n,
                        bt = $ / r;
                    const ut = Bt(G, S.bb.min.x, S.bb.max.x, 0, 1),
                        Tt = Bt($, S.bb.min.y, S.bb.max.y, 0, 1);
                    let Et = 0;
                    d.density == "h" ? (Et = z / Lt) : (Et = bt), Bt(G, S.bb.min.x, S.bb.max.x, 0, 1);
                    const Ft = Bt($, S.bb.min.y, S.bb.max.y, 0, 1),
                        wt = H(S.bb);
                    if (!re([G, $], S.points)) continue;
                    const Rt = J(G, $),
                        Ht = L(G, $);
                    let Nt = Rt && d.density !== "h" ? t.bool(0) : t.bool(h);
                    if ((h == 1 && ((Nt = !0), (h = 0.8)), (d.layers.length > 1 && I == "c" && Rt) || (d.bonly && !Rt)))
                        continue;
                    let Ot = Y > -1 ? i[Y].tangentMode : V;
                    const Yt = 20;
                    let tt = m.getTangentAtPosition(G, $, Yt, wt.radius);
                    if (!tt || isNaN(tt.x) || isNaN(tt.y)) continue;
                    m.getDistanceFromGeomAtPosition(G, $);
                    let ct = Bt(t.n2D(B * 1.3, bt * 1.3), -1, 1, (xt / n) * 0.01, (xt / n) * 0.3);
                    if (t.bool(1.5)) {
                        const ht = t.bool(0.5) ? 0.2 : 0.25,
                            gt = t.bool(0.5) ? 0.05 : 0.1;
                        let Mt = d.tScl;
                        d.comps.length == 1 && d.comps[0] == x.GRIBOUILLIS && (Mt = t.pick([0.3, 0.5, 1])),
                            (ct = Bt(t.n2D(B * 1.3, bt * 1.3), -1, 1, gt, ht) * Mt),
                            (Ot == "n" || (Ot == "c" && b)) && (ct = E * d.tScl);
                    }
                    if (
                        (t.bool(0.5) && ((tt.x = 0), (tt.y = 1)),
                        (Ot == "h" || (t.bool(0.05) && !Nt)) && ((tt.x = 1), (tt.y = t.range(-0.1, 0.1))),
                        Ot == "v" && ((tt.x = 0 + _), (tt.y = 1)),
                        Ot == "n" && (!Rt || i.length > 1))
                    ) {
                        const ht = d.compNseScl,
                            gt = (Y / i.length) * 0.15;
                        t.n2D(B * ht + gt + g, bt * ht + gt + g) * Math.PI * 2,
                            (tt.x = t.n2D(B * ht + gt + g, bt * ht + gt + g) * Math.PI * 2),
                            (tt.y = t.n2D(B * ht + gt + g * 2, bt * ht + gt + g * 2) * Math.PI * 2);
                    }
                    if (Ot == "c") {
                        let ht = 0.7;
                        d.comps.length == 1 && d.comps[0] == x.FIELD && (ht = d.compNseScl);
                        const gt = 180,
                            Mt = D,
                            Dt = t.curl2D(ut * c * ht + Mt, Tt * c * ht + Mt, 1);
                        (tt.x = Math.sign(Dt[0]) * (Math.floor(Math.abs(Dt[0]) * gt) / gt)),
                            (tt.y = Math.sign(Dt[1]) * (Math.floor(Math.abs(Dt[1]) * gt) / gt));
                    }
                    if (Ot == "oc") {
                        const Mt = D,
                            Dt = 0.1,
                            Pt = t.curl2D(ut * c * 0.7 + Mt, Tt * c * 0.7 + Mt, 1);
                        (Pt[0] = Math.sign(Pt[0]) * (Math.floor(Math.abs(Pt[0]) * 180) / 180)),
                            (Pt[1] = Math.sign(Pt[1]) * (Math.floor(Math.abs(Pt[1]) * 180) / 180)),
                            (tt.x = Se(tt.x, Pt[0], Dt)),
                            (tt.y = Se(tt.y, Pt[1], Dt));
                    }
                    if (!tt || isNaN(tt.x) || isNaN(tt.y)) continue;
                    if (Ot !== "o" && Ot !== "v" && d.rotateSkew) {
                        const ht = u + (Math.PI / 4) * Et,
                            gt = tt.x * Math.cos(ht) - tt.y * Math.sin(ht),
                            Mt = tt.x * Math.sin(ht) + tt.y * Math.cos(ht);
                        (tt.x = gt), (tt.y = Mt);
                    }
                    d.isLandscape && bt > 0.7 && ((tt.x = 1), (tt.y = 0)), (ct *= n);
                    let at = f * t.range(0.5, 1);
                    const Ct = 1e-4 * n * t.range(1, 2.3),
                        Zt = t.bool(d.multiplyAmount) ? "multiply" : "source-over";
                    let Xt = rt,
                        ee = rt,
                        ne = 1 / 0,
                        zt = -1;
                    for (let ht = 0; ht < le.length; ht++) {
                        const gt = le[ht].points;
                        if (re([G, $], gt)) {
                            let Mt = 1 / 0;
                            for (let Dt = 0; Dt < gt.length; Dt += 2) {
                                const Pt = gt[Dt],
                                    Vt = gt[Dt + 1],
                                    oe = Math.sqrt(Math.pow(G - Pt, 2) + Math.pow($ - Vt, 2));
                                Mt = Math.min(Mt, oe);
                            }
                            Mt < ne && ((ne = Mt), ht % Qt.length, (zt = ht));
                        }
                    }
                    if ((zt > -1 && t.bool(d.isStrokeColorFromB) && (Xt = le[zt].color), Nt)) {
                        if (
                            ((Xt = t.pick(Qt)),
                            t.bool(0.5) && (Xt = Qt[~~Bt(t.n2D(G / n, $ / r), -1, 1, 0, Qt.length - 1)]),
                            t.bool(0.5) && d.dirtyBgColor)
                        ) {
                            const ht = t.pick(Qt),
                                gt = Xe(ht),
                                Mt = t.range(0.3, 0.7),
                                Dt = Xe(Xt);
                            (Dt.h = Se(Dt.h, gt.h, Mt)),
                                (Dt.s = Se(Dt.s, gt.s, Mt)),
                                (Dt.l = Se(Dt.l, gt.l, Mt)),
                                (Xt = en(Dt));
                        }
                        if (
                            ((at *= t.range(0.4, 0.7)),
                            (!S.canUseGradient || rt == F) && ((at *= d.othercolorScl), d.darkOtherColorInBg))
                        ) {
                            const ht = Xe(Xt);
                            (ht.l *= t.range(0.4, 0.7)), (Xt = en(ht)), (at *= 0.5);
                        }
                    }
                    if (l) {
                        const ht = ~~Bt(t.n2D(G / n, $ / r), -1, 1, 0, Qt.length - 1);
                        Xt = Qt[ht];
                    }
                    Ot == "h" && !p && (a = t.bool(Math.pow(Et * 0.5, 2))),
                        !(Rt && (d.uniformBg && (Xt = F), !d.bfill)) &&
                            (I == "b" && (a = !0),
                            t.bool(Ft) && y && S.canUseGradient && (Xt = pt),
                            t.bool(1 - d.press) && ((Xt = d.backgroundColor), (at *= 0.7)),
                            d.light && t.bool(0.9) && Ht && !Nt && (Xt = "#FECD1A"),
                            nt.push({
                                x: G,
                                y: $,
                                tangent: tt,
                                tangentScl: ct,
                                opacity: at,
                                thickness: Ct,
                                color: Xt,
                                mixedColor: ee,
                                geomIdx: Y,
                                geom: S,
                                blendingMode: Zt,
                                stayWithinGeom: a,
                                isFirstGeom: w,
                                fillProgress: Et,
                                isOtherColor: Nt,
                                fuziness: v,
                                isInBackground: Rt,
                            }),
                            me.push({
                                x: G,
                                y: $,
                                tangent: tt,
                                tangentScl: ct,
                                opacity: at,
                                thickness: Ct,
                                color: Xt,
                                mixedColor: ee,
                                geomIdx: Y,
                                geom: S,
                                blendingMode: Zt,
                                stayWithinGeom: a,
                                isFirstGeom: w,
                                fillProgress: Et,
                                isOtherColor: Nt,
                                fuziness: v,
                                isInBackground: Rt,
                            }));
                }
                for (let z = X; z < me.length; z++);
            });
        };
    return {
        getStrokeData: () => ({ strokePoints: me, strokesData: be }),
        getPalette: () => Qt,
        setGeoms: (I) => {
            (pe = I), (m = Vo()), m.setGeoms(pe), m.render();
            for (let i = 0; i < pe.length; i++) {
                const k = t.pick(fn),
                    S = pe[i],
                    D = { points: [], color: "0x000000", tangentMode: k, isFilled: !0, canUseGradient: !0 },
                    nt = S.points,
                    Y = [];
                for (let et = 0; et < nt.length; et++) {
                    let ft = nt[et].pt.x,
                        xt = nt[et].pt.y;
                    D.points.push(ft, xt), Y.push([ft, xt]);
                }
                if (!Y.length) continue;
                const w = sn(Y),
                    X = w.maxX - w.minX,
                    V = w.maxY - w.minY,
                    N = w.minX + X / 2,
                    T = w.minY + V / 2;
                (D.bb = {
                    center: { x: N, y: T },
                    dimensions: { width: X, height: V },
                    min: { x: w.minX, y: w.minY },
                    max: { x: w.maxX, y: w.maxY },
                }),
                    (D.area = X * V);
                const lt = ot(D),
                    dt = lt.color;
                (D.color = dt), (D.neg = lt.neg), D.neg && (D.canUseGradient = !1), te.push(D);
            }
            if (d.isolation) {
                te.sort((k, S) => {
                    const D = S.area - k.area;
                    return D === 0 ? te.indexOf(k) - te.indexOf(S) : D;
                });
                const i = t.pick(Qt);
                for (let k = 0; k < te.length; k++)
                    k <= d.nbIsolated
                        ? (te[k].color = i)
                        : ((te[k].canUseGradient = !1),
                          d.negMode == "e" ? (te[k].isFilled = !1) : (te[k].color = d.backgroundColor));
            }
            for (let i = 0; i < d.layers.length; i++) {
                const k = d.layers[i];
                j(k);
            }
            yt(), mt(), vt(), St();
        },
        getStrokesData: () => be,
        setBaseShapes: (I) => {
            (Pe = I), (le = []);
            for (let i = 0; i < Pe.length; i++) {
                const k = t.pick(fn),
                    S = Pe[i],
                    D = { points: [], color: "0x000000", tangentMode: k, isFilled: !0 },
                    nt = S.points,
                    Y = [];
                for (let lt = 0; lt < nt.length; lt++) {
                    let dt = nt[lt].x,
                        et = nt[lt].y;
                    D.points.push(dt, et), Y.push([dt, et]);
                }
                if (!Y.length) continue;
                const w = sn(Y),
                    X = w.maxX - w.minX,
                    V = w.maxY - w.minY,
                    N = w.minX + X / 2,
                    T = w.minY + V / 2;
                (D.bb = {
                    center: { x: N, y: T },
                    dimensions: { width: X, height: V },
                    min: { x: w.minX, y: w.minY },
                    max: { x: w.maxX, y: w.maxY },
                }),
                    S.isDoorSide && (D.side = S.side),
                    (D.color = ot(D).color),
                    t.n2D(N, T) < 0.05,
                    le.push(D),
                    S.isDoorSide && Ye.push(D);
            }
        },
        setDataZones: (I) => {
            R = I;
        },
    };
};
let Ce = null,
    dn = null,
    Re = null,
    ke = null,
    ve = null;
const _o = async (e) => {
    const n = document.createElement("div");
    (n.textContent = "generating"), document.body.appendChild(n), performance.now(), (Ce = Fo());
    const r = Ce.getCanvas();
    await new Promise((c) => setTimeout(c, 100)),
        Ce.render(),
        (dn = No()),
        (ke = Bo()),
        ke.setBaseShapes(Ce.getShapes()),
        ke.fromImage(r),
        (ve = Yo()),
        ve.setDataZones(dn.getZones()),
        ve.setBaseShapes(Ce.getShapes()),
        ve.setGeoms(ke.getGeoms()),
        (Re = Xo()),
        Re.setRawIslandsData(ke.getGeoms()),
        Re.setStrokesData(ve.getStrokeData()),
        Re.play?.(),
        document.body.appendChild(Re.getFinalCanvas()),
        Tn.on(Gn.RENDER_COMPLETE, () => {
            console.log("render complete"), capturePreview();
        }),
        document.body.removeChild(n);
};
_o();
