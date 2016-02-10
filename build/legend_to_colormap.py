rows = [{'label': '1 Croplands, rainfed, SC (Season 1 & 2), all crops', 'color': '#FFFF00'},
                {'label': '2 Croplands, rainfed,SC, pastures', 'color': '#66FFFF'},
                {'label': '3 Croplands, irrigated, SC, DC (Season 1 & 2), all crops', 'color': '#FF66FF'},
                {'label': '4 Croplands, irrigated, SC, pastures', 'color': '#00B0F0'},
                {'label': '5 Croplands, irrigated, continuous, orchards ', 'color': '#00B050'},
                {'label': '6 Croplands,  fallow ', 'color': '#FBD4B4'}]

for i, row in enumerate(rows):
    print '<ColorMapEntry color="%s" label="%s" quantity="%d"/>' % ( row['color'], row['label'], i + 1)





