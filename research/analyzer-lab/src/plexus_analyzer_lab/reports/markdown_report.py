def render_markdown(report):
    track = report["track"]
    lines = [f"# Analyzer lab: {track['trackId']}", "", report["interpretation"], "",
             f"Duration: {track['duration']:.6f} s; sample rate: {track['sampleRate']} Hz.", "",
             "| Provider | Status | Reason |", "| --- | --- | --- |"]
    escape = lambda value: str(value).replace("|", "\\|").replace("\n", " ")
    for provider, entry in report["providers"].items():
        lines.append(f"| {provider} | {entry['status']} | {escape(entry.get('reason', ''))} |")
    if not report["comparisons"]:
        lines += ["", "Comparison not_available: successful Plexus and oracle results are both required."]
    for comparison in report["comparisons"]:
        lines += ["", f"## {comparison['provider']} versus {comparison['referenceProvider']}", "",
                  "| Metric | Status | Evidence |", "| --- | --- | --- |"]
        for name, metric in comparison["metrics"].items():
            details = "; ".join(f"{k}={v}" for k, v in metric.items() if k != "status")
            lines.append(f"| {name} | {metric['status']} | {escape(details)} |")
    return "\n".join(lines) + "\n"
