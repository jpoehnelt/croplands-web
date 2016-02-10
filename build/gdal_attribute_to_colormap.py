import xml.etree.ElementTree as ET


tree = ET.parse('attributes.xml')
root = tree.getroot()

for child in root:
    if child.tag == 'Row' and int(child[0].text) > 0:

        r = hex(int(child[1].text))[2:].zfill(2)
        g = hex(int(child[2].text))[2:].zfill(2)
        b = hex(int(child[3].text))[2:].zfill(2)

        color = "#" + r + g + b;
        index = child.attrib['index']
        label = child[5].text
        # print child[0].text, index, r, g, b, label, color

        print '{label: "%s", color: "%s"},' % (label, color)