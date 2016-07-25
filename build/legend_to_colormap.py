rows = [{"label": "Unclassified", "color": "#000000"},
                {"label": "Irrigated-SW/GW-DC-rice-wheat", "color": "#006400"},
                {"label": "Irrigated-SW/GW-DC-rice-rice", "color": "#00ff00"},
                {"label": "Irrgated-SW-DC-beans/cotton-wheat", "color": "#a0c27c"},
                {"label": "Irrigated-SW-DC-Sugarcane/rice-rice/Plantations", "color": "#7e9e65"},
                {"label": "Irrigated-DC-fallows/pulses-rice-fallow", "color": "#c5e5a4"},
                {"label": "Irrigated-GW-DC-rice-maize/chickpea", "color": "#7fffd4"},
                {"label": "Irrgated-TC-rice-mixedcrops-mixedcrops", "color": "#40e0d0"},
                {"label": "Irrigated-GW-DC-millet/sorghum/potato-wheat/mustartd", "color": "#cfe09c"},
                {"label": "Irrigated-SW-DC-cotton/chilli/maize-fallow/pulses", "color": "#00ffff"},
                {"label": "Rainfed-DC-rice-fallows-jute/rice/mixed crops", "color": "#ffff00"},
                {"label": "Rainfed-SC-rice-fallow/pulses", "color": "#ffd700"},
                {"label": "Rainfed-DC-millets-chickpea/Fallows", "color": "#cdad00"},
                {"label": "Rainfed-SC-cotton/pigeonpea/mixedcrops", "color": "#8b6913"},
                {"label": "Rainfed-SC-groundnut/millets/sorghum", "color": "#cd853f"},
                {"label": "Rainfed-SC-pigeonpea/mixedcrops", "color": "#ee9a49"},
                {"label": "Rainfed-SC-millet-fallows/mixedcrops-", "color": "#d8a585"},
                {"label": "Rainfed-SC-fallow-chickpea-", "color": "#e6bc8a"},
                {"label": "Rainfed-SC-millets/fallows-LS", "color": "#e0cab4"},
                {"label": "Rainfed-SC-mixedcrops/Plantations", "color": "#bd5e4d"},
                {"label": "Shrublands/trees/Rainfed-mixedcrops30%", "color": "#a020f0"},
                {"label": "Other LULC", "color": "#c0c0c0"}]

for i, row in enumerate(rows):
    print '<ColorMapEntry color="%s" label="%s" quantity="%d"/>' % ( row['color'], row['label'], i)





