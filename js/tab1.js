function calcS1() {
    let cumRf = 0, cumFfb = 0;
    for (let d = 1; d <= 31; d++) {
        let rfVal = parseFloat(document.getElementById(`s1_rf_${d}`)?.value) || 0;
        cumRf += rfVal;
        if (document.getElementById(`s1_rf_todate_${d}`)) {
            document.getElementById(`s1_rf_todate_${d}`).innerText = cumRf > 0 ? cumRf.toFixed(2) : '';
        }

        let ffbVal = parseFloat(document.getElementById(`s1_ffb1_${d}`)?.value) || 0;
        cumFfb += ffbVal;
        if (document.getElementById(`s1_gt_todate_${d}`)) {
            document.getElementById(`s1_gt_todate_${d}`).innerText = cumFfb > 0 ? cumFfb.toFixed(2) : '';
        }
    }
}
