"""Builds the Axiom dashboard "Palikka – lokit" (schemaVersion 2) as dashboard.json next to this file.

Create:  python tools/axiom/dashboard.py; pwsh tools/axiom/axiom.ps1 POST /v2/dashboards tools/axiom/dashboard.json
Update:  the same with PUT /v2/dashboards/uid/<uid> (the uid is in docs/operations.md → Logs;
         "overwrite" replaces the live version).
"""
import os
import json
import uuid

DS = "palikka"
PARAMS = ('declare query_parameters (source_filter:string = "", kind_filter:string = "", '
          'room_filter:string = "", bot_filter:string = "", ver_filter:string = "");\n')
BASE = PARAMS + f"""['{DS}']
| extend kind = case(
    evt startswith "cmd.", "audit",
    evt startswith "game." or evt startswith "turn." or evt startswith "phase." or evt startswith "treasure." or evt startswith "bot.", "game",
    evt startswith "player." or evt startswith "client.conn" or evt startswith "room.", "conn",
    evt == "http.request", "http",
    "other")
| extend isBot = coalesce(tobool(column_ifexists("bot", bool(null))), false)
| where isempty(source_filter) or src == source_filter
| where isempty(kind_filter) or kind == kind_filter or (kind_filter == "problems" and level in ("error", "warn"))
| where isempty(room_filter) or tostring(column_ifexists("room", "")) contains room_filter
| where isempty(bot_filter) or (bot_filter == "bots" and isBot) or (bot_filter == "people" and not(isBot))
| where isempty(ver_filter) or ver == ver_filter
"""


def query(apl):
    return {"apl": apl, "queryOptions": {"containsTimeFilter": "false", "datasets": DS, "editorContent": apl,
                                         "quickRange": "", "startTime": "", "endTime": ""}}


charts, layout = [], []


def add(chart, x, y, w, h):
    cid = str(uuid.uuid4())
    chart["id"] = cid
    chart.setdefault("numSeries", 1)
    charts.append(chart)
    layout.append({"i": cid, "x": x, "y": y, "w": w, "h": h, "minW": 2, "minH": 1, "moved": False, "static": False})


def list_filter(fid, name, options):
    return {"active": True, "id": fid, "name": name, "type": "select", "selectType": "list",
            "options": [{"key": "Kaikki", "value": "", "default": True}] + [{"key": k, "value": v} for k, v in options]}


filters = [
    list_filter("source_filter", "Lähde", [("Palvelin", "server"), ("Client", "client")]),
    list_filter("kind_filter", "Tyyppi", [("Audit (komennot)", "audit"), ("Pelin kulku", "game"),
                                          ("Yhteydet", "conn"), ("HTTP", "http"),
                                          ("Virheet ja varoitukset", "problems")]),
    {"active": True, "id": "room_filter", "name": "Peli (tunnus)", "type": "search", "selectType": "list",
     "options": [{"key": "Kaikki", "value": "", "default": True}]},
    list_filter("bot_filter", "Botit", [("Vain ihmiset", "people"), ("Vain botit", "bots")]),
    {"active": True, "id": "ver_filter", "name": "Versio", "type": "select", "selectType": "apl",
     "apl": {"apl": f"['{DS}'] | distinct ver | project key=ver, value=ver | sort by key desc",
             "queryOptions": {"datasets": DS, "quickRange": "7d"}},
     "options": [{"key": "Kaikki", "value": "", "default": True}]},
]
add({"name": "Suodattimet", "type": "SmartFilter", "filters": filters, "query": {"apl": "", "queryOptions": {}}}, 0, 0, 12, 1)

stat = lambda name, apl, color: {"name": name, "type": "Statistic", "colorScheme": color, "customUnits": "",
                                 "datasetId": DS, "query": query(apl)}
add(stat("Pelejä aloitettu", BASE + '| where evt == "game.started" | summarize count() by bin_auto(_time)', "Blue"), 0, 1, 3, 3)
add(stat("Virheitä", BASE + '| where level == "error" | summarize count() by bin_auto(_time)', "Red"), 3, 1, 3, 3)
add(stat("Hylättyjä komentoja", BASE + '| where evt == "cmd.rejected" | summarize count() by bin_auto(_time)', "Orange"), 6, 1, 3, 3)
add(stat("Botin varasiirtoja", BASE + '| where evt == "bot.fallback" | summarize count() by bin_auto(_time)', "Purple"), 9, 1, 3, 3)

ts = lambda name, apl: {"name": name, "type": "TimeSeries", "datasetId": DS, "query": query(apl)}
add(ts("Lokirivit tason mukaan", BASE + "| summarize count() by bin_auto(_time), level"), 0, 4, 6, 5)
add(ts("Päättyneet pelit syyn mukaan", BASE + '| where evt == "game.finished" | summarize count() by bin_auto(_time), reason = tostring(column_ifexists("reason", ""))'), 6, 4, 6, 5)

table_settings = {"columns": [], "settings": {"hideNulls": True, "highlightSeverity": True, "isLive": "OFF",
                                              "showEvent": True, "showFieldList": False, "showHistory": False,
                                              "showRaw": False, "showSavedQueries": False, "showTimestamp": True,
                                              "wrapLines": True}}
LOG_TABLE = BASE + """| project _time, level, evt, room = column_ifexists("room", ""), seat = column_ifexists("seat", long(null)),
    player = column_ifexists("player", ""), cmd = column_ifexists("cmd", ""), code = tostring(column_ifexists("code", "")),
    msg = column_ifexists("msg", ""), src, ver
| sort by _time desc
| take 1000"""
add({"name": "Lokit (uusimmat ensin)", "type": "Table", "datasetId": DS, "query": query(LOG_TABLE),
     "tableSettings": table_settings}, 0, 9, 12, 14)
add({"name": "Hylätyt komennot koodeittain", "type": "Table", "datasetId": DS,
     "query": query(BASE + '| where evt == "cmd.rejected" | summarize kpl = count() by cmd = tostring(cmd), code = tostring(code) | sort by kpl desc'),
     "tableSettings": table_settings}, 0, 23, 6, 6)
add({"name": "Pelityypit", "type": "Table", "datasetId": DS,
     "query": query(BASE + '| where evt == "game.started" | summarize kpl = count() by pikapeli = tostring(column_ifexists("quick", false)), pelaajia = array_length(seats) | sort by kpl desc'),
     "tableSettings": table_settings}, 6, 23, 6, 6)

dashboard = {
    "name": "Palikka – lokit",
    "description": "Palikan tuotantolokit (palvelin + client). Suodata yläpalkista lähteen, tyypin, pelin, bottien ja version mukaan.",
    "owner": "X-AXIOM-EVERYONE",
    "charts": charts,
    "layout": layout,
    "refreshTime": 60,
    "schemaVersion": 2,
    "timeWindowStart": "qr-now-24h",
    "timeWindowEnd": "qr-now",
    "datasets": [DS],
    "overrides": {},
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.json")
open(out, "w", encoding="utf8", newline="\n").write(json.dumps({"dashboard": dashboard, "overwrite": True}, ensure_ascii=False))
print(out, len(charts), "charts")
