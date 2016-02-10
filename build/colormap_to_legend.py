colormap = """<ColorMapEntry color="#aec7e8" label="C; IR; sc; mc I/rice" quantity="1"/>
                <ColorMapEntry color="#aec7e8" label="C; IR; sc; mc II/rice/sorghum" quantity="2"/>
            	<ColorMapEntry color="#ffbb78" label="C; IR; dc; mc I/rice" quantity="3"/>
            	<ColorMapEntry color="#ffbb78" label="C; IR; dc; mc II/rice" quantity="4"/>
            	<ColorMapEntry color="#98df8a" label="C; IR; cc; sugarcane/plantations/other crops" quantity="5"/>"""

rows = colormap.split("\n")
for row in rows:
    row = row.strip()
    color =  row[row.find('color=') + 7: row.find('color=') + 14]
    label = row[row.find('label=') + 7 :row.find('"', row.find('label=') + 7) ]
    print '{label: "%s", color: "%s"},' % (label, color)




