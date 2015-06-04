
app.constant('mappings', {
    landUseType: {'label': 'Land Use Type',
        'style': 'primary',
        'choices': [
            {'id': 0, 'order': 8, 'label': 'Unknown', 'description': 'Not cropland is...'},
            {'id': 1, 'order': 1, 'label': 'Cropland', 'description': 'Cropland is...'},
            {'id': 2, 'order': 4, 'label': 'Forest', 'description': 'Forest is ...'},
            {'id': 3, 'order': 3, 'label': 'Grassland', 'description': 'Grassland is ...'},
            {'id': 4, 'order': 2, 'label': 'Barren', 'description': 'Barrenland is ...'},
            {'id': 5, 'order': 6, 'label': 'Builtup', 'description': 'Urban is ...'},
            {'id': 6, 'order': 5, 'label': 'Shrub', 'description': 'Shrub is ...'},
            {'id': 7, 'order': 7, 'label': 'Water', 'description': 'Water is ...'}
        ]},

    water: {'label': 'Water Source',
        'style': 'danger',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No irrigation specified...'},
            {'id': 1, 'label': 'Rainfed',
                'description': 'Rainfed is ...'},
            {'id': 2, 'label': 'Irrigated',
                'description': 'Irrigated is ...'}
        ]
    },
    intensity: {'label': 'Intensify of Cropping',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Single', 'description': 'Single is...'},
            {'id': 2, 'label': 'Double', 'description': 'Double is...'},
            {'id': 3, 'label': 'Triple', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Continuous', 'description': 'Continuous is...'}
        ]
    },    source: {'label': 'Source of data',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Site Visit', 'description': 'Single is...'},
            {'id': 2, 'label': 'Satellite', 'description': 'Double is...'},
            {'id': 3, 'label': 'Third Party', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Other', 'description': 'Continuous is...'}
        ]
    },
    confidence: {'label': 'Confidence',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Low', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Moderate', 'description': 'Single is...'},
            {'id': 2, 'label': 'High', 'description': 'Double is...'}
        ]
    },
    crop: {'label': 'Crop Type',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No crop type specified.'},
            {'id': 1, 'label': 'Wheat', 'description': ''},
            {'id': 2, 'label': 'Maize (Corn)', 'description': ''},
            {'id': 3, 'label': 'Rice', 'description': ''},
            {'id': 4, 'label': 'Barley', 'description': ''},
            {'id': 5, 'label': 'Soybeans', 'description': ''},
            {'id': 6, 'label': 'Pulses', 'description': ''},
            {'id': 7, 'label': 'Cotton', 'description': ''},
            {'id': 8, 'label': 'Potatoes', 'description': ''},
            {'id': 9, 'label': 'Alfalfa', 'description': ''},
            {'id': 10, 'label': 'Sorghum', 'description': ''},
            {'id': 11, 'label': 'Millet', 'description': ''},
            {'id': 12, 'label': 'Sunflower', 'description': ''},
            {'id': 13, 'label': 'Rye', 'description': ''},
            {'id': 14, 'label': 'Rapeseed or Canola', 'description': ''},
            {'id': 15, 'label': 'Sugarcane', 'description': ''},
            {'id': 16, 'label': 'Groundnuts or Peanuts', 'description': ''},
            {'id': 17, 'label': 'Cassava', 'description': ''},
            {'id': 18, 'label': 'Sugarbeets', 'description': ''},
            {'id': 19, 'label': 'Palm', 'description': ''},
            {'id': 20, 'label': 'Others', 'description': ''},
            {'id': 21, 'label': 'Plantations', 'description': 'Plantations or other continuous crops'},
            {'id': 22, 'label': 'Fallow', 'description': ''}
        ]
    },
    lat: {
        'label': 'Latitude'
    },
    long: {
        'label': 'Longitude'
    }

});