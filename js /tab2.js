function calcS2() {
    for (let p = 1; p <= 4; p++) {
        let cum = 0;
        for (let d = 1; d <= 31; d++) {
            let val = parseFloat(document.getElementById(`s2_p${p}_t_${d}`)?.value) || 0;
            cum += val;
            if (document.getElementById(`s2_p${p}_td_${d}`)) {
                document.getElementById(`s2_p${p}_td_${d}`).innerText = cum > 0 ? cum.toFixed(2) : '';
            }
        }
    }
}
