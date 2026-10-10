/* SuperV Ease: applies a cubic-bezier curve as native After Effects temporal easing. ES3 only. */
function VKEase(h) {
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function easable(p) {
        var t = p.propertyValueType;
        return t === PropertyValueType.OneD || t === PropertyValueType.TwoD || t === PropertyValueType.ThreeD ||
            t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL || t === PropertyValueType.COLOR;
    }
    function owner(p) { var q = p; while (q.parentProperty) q = q.parentProperty; return q; }
    // Average speed per ease dimension over one segment. Spatial properties use one speed along the path.
    function averageSpeeds(p, k, n, T) {
        var v0 = p.keyValue(k), v1 = p.keyValue(k + 1), out = [], d;
        if (!(v0 instanceof Array)) return [(v1 - v0) / T];
        if (n === 1) { var sum = 0; for (d = 0; d < v0.length; d++) sum += (v1[d] - v0[d]) * (v1[d] - v0[d]); return [Math.sqrt(sum) / T]; }
        for (d = 0; d < n; d++) out.push((v1[d] - v0[d]) / T);
        return out;
    }
    // One segment k -> k+1. Handle 1 = (x1, y1) of the outgoing side, handle 2 = (x2, y2) of the incoming side.
    function easeSegment(p, k, c, linear) {
        var T = p.keyTime(k + 1) - p.keyTime(k);
        if (T <= 0 || p.keyOutInterpolationType(k) === KeyframeInterpolationType.HOLD) return false;
        if (linear) {
            p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), KeyframeInterpolationType.LINEAR);
            p.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.LINEAR, p.keyOutInterpolationType(k + 1));
            return true;
        }
        var n = p.keyOutTemporalEase(k).length, spatial = n === 1 && (p.keyValue(k) instanceof Array);
        var avg = averageSpeeds(p, k, n, T);
        var x1 = clamp(c[0], 0.01, 1), y1 = c[1], x2 = clamp(c[2], 0, 0.99), y2 = c[3];
        var outInfluence = clamp(x1 * 100, 0.1, 100), inInfluence = clamp((1 - x2) * 100, 0.1, 100);
        var outE = [], inE = [], d, so, si;
        for (d = 0; d < n; d++) {
            so = avg[d] * y1 / x1; si = avg[d] * (1 - y2) / (1 - x2);
            if (spatial) { so = Math.max(0, so); si = Math.max(0, si); } // speed along a path cannot go negative
            outE.push(new KeyframeEase(so, outInfluence));
            inE.push(new KeyframeEase(si, inInfluence));
        }
        p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), KeyframeInterpolationType.BEZIER);
        p.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k + 1));
        var j;
        for (j = k; j <= k + 1; j++) { try { p.setTemporalContinuousAtKey(j, false); p.setTemporalAutoBezierAtKey(j, false); } catch (ignore) {} }
        p.setTemporalEaseAtKey(k, p.keyInTemporalEase(k), outE);
        p.setTemporalEaseAtKey(k + 1, inE, p.keyOutTemporalEase(k + 1));
        return true;
    }
    function ease(o) {
        var c = h.comp(), sel = c.selectedProperties, props = [], skipped = 0, i, k;
        var curve = o.curve, mode = o.mode === 'all' ? 'all' : 'between';
        if (!o.linear) {
            if (!(curve instanceof Array) || curve.length !== 4) h.fail('Choose a curve first.');
            for (i = 0; i < 4; i++) if (typeof curve[i] !== 'number' || !isFinite(curve[i])) h.fail('The curve values must be numbers.');
            if (curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) h.fail('Curve handles must stay between 0 and 1 across.');
        }
        for (i = 0; i < sel.length; i++) {
            var p = sel[i];
            if (p.propertyType !== PropertyType.PROPERTY || p.numKeys < 2) continue;
            if (!easable(p)) { skipped++; continue; }
            if (owner(p).locked) h.fail('Unlock the layers whose keyframes you want to ease.');
            props.push(p);
        }
        if (!props.length) h.fail(skipped ? 'These keyframes cannot be eased (for example shape paths or text). Select number, position, scale, rotation, opacity or colour keyframes.' : 'Select keyframes in the timeline first (at least two on a property).');
        var segments = 0, touched = 0;
        for (i = 0; i < props.length; i++) {
            var pr = props[i], done = 0;
            if (mode === 'all') { for (k = 1; k < pr.numKeys; k++) if (easeSegment(pr, k, curve, o.linear)) done++; }
            else {
                var keys = pr.selectedKeys, chosen = {}, j;
                for (j = 0; j < keys.length; j++) chosen[keys[j]] = true;
                for (k = 1; k < pr.numKeys; k++) if (chosen[k] && chosen[k + 1] && easeSegment(pr, k, curve, o.linear)) done++;
            }
            segments += done; if (done) touched++;
        }
        if (!segments) h.fail(mode === 'all' ? 'Nothing to ease: the selected properties need at least two keyframes.' : 'Select at least two neighbouring keyframes, or switch to All keys.');
        return { message: (o.linear ? 'Made ' : 'Eased ') + segments + ' segment' + (segments === 1 ? '' : 's') + ' on ' + touched + ' propert' + (touched === 1 ? 'y' : 'ies') + (o.linear ? ' linear.' : '.') + (skipped ? ' ' + skipped + ' unsupported propert' + (skipped === 1 ? 'y was' : 'ies were') + ' skipped.' : '') };
    }
    return { ease: ease, _test: { easeSegment: easeSegment, averageSpeeds: averageSpeeds } };
}
