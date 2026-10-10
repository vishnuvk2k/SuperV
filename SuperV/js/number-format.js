/* ES3-compatible: shared by the panel preview and AE's Source Text expression. */
function VKFormatNumber(value, decimals, commas, first, every, prefix, suffix) {
    var parts = Number(value).toFixed(decimals).split('.');
    if (commas) {
        var digits = parts[0], sign = '', groups = [], size = first;
        if (digits.charAt(0) === '-') { sign = '-'; digits = digits.substring(1); }
        while (digits.length > size) {
            groups.unshift(digits.substring(digits.length - size));
            digits = digits.substring(0, digits.length - size);
            size = every;
        }
        groups.unshift(digits);
        parts[0] = sign + groups.join(',');
    }
    return String(prefix || '') + parts.join('.') + String(suffix || '');
}
