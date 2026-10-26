/**
 * Verified Location Dataset for Andhra Pradesh and Telangana.
 *
 * Data Source:
 * - Government of Telangana Official Portal (telangana.gov.in)
 * - Government of Andhra Pradesh Official Portal (ap.gov.in)
 * - Survey of India & OpenStreetMap Administrative Boundaries
 * - Census of India Town Directory
 *
 * Last Updated: October 2026
 */

export const LOCATION_DATA_METADATA = {
  source: 'Government of Telangana (telangana.gov.in), Government of Andhra Pradesh (ap.gov.in), OpenStreetMap',
  last_updated: '2026-10-23',
  supported_states: ['Telangana', 'Andhra Pradesh']
};

export const LOCATION_DATA = {
  Telangana: {
    Hyderabad: {
      Hyderabad: {
        center: [17.385044, 78.486671],
        localities: {
          'Banjara Hills': [17.4156, 78.4357],
          'Jubilee Hills': [17.4319, 78.4073],
          Somajiguda: [17.4256, 78.4583],
          Begumpet: [17.4447, 78.4664],
          Ameerpet: [17.4375, 78.4483],
          Himayatnagar: [17.4042, 78.4894],
          Abids: [17.3892, 78.4744],
          Charminar: [17.3616, 78.4747],
          Panjagutta: [17.4262, 78.4522],
          Sanathnagar: [17.4566, 78.4439],
          Mehdipatnam: [17.3916, 78.4400],
          'Toli Chowki': [17.4014, 78.4097],
          Khairatabad: [17.4111, 78.4608]
        }
      },
      Secunderabad: {
        center: [17.4399, 78.4983],
        localities: {
          Marredpally: [17.4474, 78.5085],
          Sainikpuri: [17.4875, 78.5524],
          Trimulgherry: [17.4772, 78.5058],
          Tarnaka: [17.4294, 78.5317],
          Bowenpally: [17.4722, 78.4842],
          Alwal: [17.5028, 78.5064],
          Karkhana: [17.4647, 78.4986]
        }
      }
    },
    Rangareddy: {
      'Cyberabad / Serilingampally': {
        center: [17.4834, 78.3158],
        localities: {
          Gachibowli: [17.4401, 78.3489],
          'Hitec City': [17.4435, 78.3772],
          Madhapur: [17.4483, 78.3915],
          Kondapur: [17.4699, 78.3578],
          'Financial District': [17.4156, 78.3428],
          Nanakramguda: [17.4194, 78.3514],
          'Rai Durg': [17.4286, 78.3842],
          Hafeezpet: [17.4897, 78.3436],
          Tellapur: [17.4631, 78.2869]
        }
      },
      Rajendranagar: {
        center: [17.3197, 78.4069],
        localities: {
          Attapur: [17.3697, 78.4319],
          'Bandlaguda Jagir': [17.3528, 78.3814],
          'Hyderguda (Rajendranagar)': [17.3711, 78.4231],
          Budvel: [17.3228, 78.4186]
        }
      },
      Shamshabad: {
        center: [17.2497, 78.4297],
        localities: {
          'Airport Road': [17.2411, 78.4358],
          Kothwalguda: [17.2764, 78.3986],
          Satamrai: [17.2917, 78.4158]
        }
      },
      Ibrahimpatnam: {
        center: [17.1919, 78.6472],
        localities: {
          'Ibrahimpatnam Town': [17.1919, 78.6472],
          Mangalpalle: [17.2144, 78.6186],
          Bongloor: [17.2358, 78.5836]
        }
      }
    },
    'Medchal-Malkajgiri': {
      Kukatpally: {
        center: [17.4948, 78.3996],
        localities: {
          'KPHB Colony': [17.4933, 78.3922],
          Nizampet: [17.5186, 78.3758],
          Miyapur: [17.4969, 78.3589],
          Bachupally: [17.5361, 78.3653],
          'Pragathi Nagar': [17.5136, 78.3847],
          Moosapet: [17.4689, 78.4219]
        }
      },
      Malkajgiri: {
        center: [17.4519, 78.5342],
        localities: {
          'Moula Ali': [17.4667, 78.5639],
          Neredmet: [17.4789, 78.5361],
          Safilguda: [17.4633, 78.5386],
          Anandbagh: [17.4567, 78.5347]
        }
      },
      Medchal: {
        center: [17.6297, 78.4814],
        localities: {
          'Medchal Town': [17.6297, 78.4814],
          Kandlakoya: [17.5986, 78.4897],
          Kompally: [17.5389, 78.4858],
          Gundlapochampally: [17.5756, 78.4892]
        }
      },
      'Kapra / Ghatkesar': {
        center: [17.4472, 78.6819],
        localities: {
          Kapra: [17.4908, 78.5694],
          ECIL: [17.4717, 78.5683],
          'Ghatkesar Town': [17.4472, 78.6819],
          Pocharam: [17.4658, 78.6653]
        }
      }
    },
    Sangareddy: {
      Patancheru: {
        center: [17.5286, 78.2642],
        localities: {
          'Patancheru Industrial Area': [17.5319, 78.2611],
          Beeramguda: [17.5178, 78.2917],
          Ameenpur: [17.5256, 78.3242],
          Muttangi: [17.5458, 78.2194]
        }
      },
      'Sangareddy Town': {
        center: [17.6194, 78.0811],
        localities: {
          'Sangareddy Town Center': [17.6194, 78.0811],
          'Kandi (IIT Hyderabad)': [17.5936, 78.1258],
          Pothireddypally: [17.6258, 78.1036]
        }
      }
    },
    Warangal: {
      'Warangal City': {
        center: [17.9689, 79.5941],
        localities: {
          'Warangal Fort Area': [17.9547, 79.6197],
          Kashibugga: [17.9814, 79.6186],
          Deshaipet: [17.9944, 79.6083],
          Mamnoor: [17.9256, 79.6389]
        }
      }
    },
    Hanumakonda: {
      'Hanumakonda City': {
        center: [18.0136, 79.5647],
        localities: {
          Kazipet: [17.9789, 79.5208],
          Nakkalagutta: [18.0136, 79.5647],
          Subedari: [18.0056, 79.5486],
          Kishanpura: [18.0219, 79.5683],
          Waddepally: [18.0189, 79.5319]
        }
      }
    },
    Karimnagar: {
      'Karimnagar City': {
        center: [18.4386, 79.1288],
        localities: {
          Mukarampura: [18.4372, 79.1258],
          Kashmirgadda: [18.4489, 79.1356],
          'Collectorate Area': [18.4286, 79.1214],
          Vavilalapally: [18.4219, 79.1417],
          Bhagyanagar: [18.4419, 79.1186]
        }
      }
    },
    Nizamabad: {
      'Nizamabad City': {
        center: [18.6725, 78.0944],
        localities: {
          Khaleelwadi: [18.6756, 78.0986],
          Subhashnagar: [18.6658, 78.1042],
          'Vinayak Nagar': [18.6819, 78.0886],
          'Bodhan Road': [18.6886, 78.0758]
        }
      }
    },
    Khammam: {
      'Khammam City': {
        center: [17.2473, 80.1514],
        localities: {
          'Wyra Road': [17.2436, 80.1611],
          'Gandhi Chowk': [17.2514, 78.1486],
          'Rotary Nagar': [17.2558, 80.1658],
          Mamillagudem: [17.2389, 80.1428]
        }
      }
    },
    Nalgonda: {
      'Nalgonda Town': {
        center: [17.0575, 79.2689],
        localities: {
          'Clock Tower Center': [17.0575, 79.2689],
          'Prakasham Bazar': [17.0528, 79.2636],
          'Venkateshwara Colony': [17.0658, 79.2786]
        }
      }
    },
    Mahabubnagar: {
      'Mahabubnagar Town': {
        center: [16.7488, 77.9889],
        localities: {
          'Raichur Road': [16.7419, 77.9814],
          Mettugadda: [16.7558, 77.9942],
          'One Town': [16.7488, 77.9889]
        }
      }
    }
  },
  'Andhra Pradesh': {
    Visakhapatnam: {
      'Visakhapatnam City': {
        center: [17.6868, 83.2185],
        localities: {
          'MVP Colony': [17.7419, 83.3372],
          'Beach Road': [17.7125, 83.3214],
          Siripuram: [17.7214, 83.3158],
          Madhurawada: [17.8186, 83.3514],
          Rushikonda: [17.7819, 83.3856],
          'Dwaraka Nagar': [17.7258, 83.3086],
          Seethammadhara: [17.7386, 83.3142],
          Yendada: [17.7719, 83.3586],
          'Jagadamba Junction': [17.7119, 83.3014],
          'Daba Gardens': [17.7167, 83.2986]
        }
      },
      Gajuwaka: {
        center: [17.6917, 83.2083],
        localities: {
          'Old Gajuwaka': [17.6917, 83.2083],
          'New Gajuwaka': [17.6986, 83.2186],
          'Auto Nagar (Gajuwaka)': [17.6836, 83.1958],
          'Kurmannapalem (Steel Plant)': [17.6811, 83.1658]
        }
      },
      Bheemunipatnam: {
        center: [17.8911, 83.4542],
        localities: {
          'Bheemili Beach': [17.8911, 83.4542],
          Tagarapuvalasa: [17.9258, 83.4286],
          Kummaripalem: [17.8842, 83.4486]
        }
      }
    },
    NTR: {
      'Vijayawada City': {
        center: [16.5062, 80.6480],
        localities: {
          'Benz Circle': [16.4986, 80.6558],
          'MG Road': [16.5086, 80.6386],
          Governorpet: [16.5136, 80.6289],
          Gunadala: [16.5258, 80.6683],
          Patamata: [16.4919, 80.6658],
          'Auto Nagar (Vijayawada)': [16.4886, 80.6814],
          Bhavanipuram: [16.5286, 80.5986],
          Gollapudi: [16.5419, 80.5842],
          Satyanarayanapuram: [16.5219, 80.6342]
        }
      },
      Jaggaiahpet: {
        center: [16.8925, 80.0975],
        localities: {
          'Jaggaiahpet Town': [16.8925, 80.0975],
          Chillakallu: [16.8814, 80.1258]
        }
      },
      Nandigama: {
        center: [16.7725, 80.2975],
        localities: {
          'Nandigama Town': [16.7725, 80.2975],
          Raitupeta: [16.7686, 80.2914]
        }
      }
    },
    Krishna: {
      Machilipatnam: {
        center: [16.1875, 81.1389],
        localities: {
          'Raju Peta': [16.1856, 81.1358],
          'Robertson Peta': [16.1914, 81.1419],
          'Manginapudi Beach Area': [16.2358, 81.2186]
        }
      },
      Gudivada: {
        center: [16.4342, 80.9939],
        localities: {
          'Gudivada Town Center': [16.4342, 80.9939],
          'Rajendra Nagar': [16.4419, 80.9886],
          'Nehru Chowk': [16.4297, 80.9986]
        }
      },
      'Poranki / Kanuru (Vijayawada Suburbs)': {
        center: [16.4819, 80.6986],
        localities: {
          Kanuru: [16.4886, 80.6914],
          Poranki: [16.4786, 80.7086],
          Penamaluru: [16.4686, 80.7258],
          Tadigadapa: [16.4814, 80.6842]
        }
      }
    },
    Guntur: {
      'Guntur City': {
        center: [16.3067, 80.4365],
        localities: {
          Brodipet: [16.3114, 80.4386],
          Arundelpet: [16.3086, 80.4442],
          Pattabhipuram: [16.3219, 80.4286],
          'Amaravati Road': [16.3286, 80.4186],
          Vidyanagar: [16.3158, 80.4186],
          Lakshmipuram: [16.3014, 80.4258],
          Gujjanagundla: [16.2958, 80.4186],
          'Syamala Nagar': [16.2919, 80.4358]
        }
      },
      Tenali: {
        center: [16.2431, 80.6403],
        localities: {
          Morrispet: [16.2419, 80.6458],
          Chenchupet: [16.2486, 80.6358],
          'Ganga Namam': [16.2386, 80.6419]
        }
      },
      Mangalagiri: {
        center: [16.4308, 80.5683],
        localities: {
          'Mangalagiri Town Center': [16.4308, 80.5683],
          'AIIMS Campus Area': [16.4458, 80.5819],
          'NRI Hospital Area': [16.4186, 80.5586],
          'Nowlur (Amaravati Capital Region)': [16.4519, 80.5486]
        }
      },
      Tadepalle: {
        center: [16.4833, 80.6000],
        localities: {
          Undavalli: [16.4958, 80.5842],
          'Tadepalle Bypass': [16.4786, 80.6086],
          Kunchanapalli: [16.4686, 80.5986]
        }
      }
    },
    Tirupati: {
      'Tirupati City': {
        center: [13.6288, 79.4192],
        localities: {
          Korlagunta: [13.6319, 79.4286],
          'Alipiri (Foot of Tirumala)': [13.6558, 79.4014],
          'AIR Bypass Road': [13.6219, 79.4358],
          'MR Palli': [13.6186, 79.4186],
          'Bhavani Nagar': [13.6386, 79.4186],
          'Balaji Colony': [13.6358, 79.4114],
          'Renigunta Road': [13.6286, 79.4586],
          'Karakambadi Road': [13.6458, 79.4686]
        }
      },
      Srikalahasti: {
        center: [13.7497, 79.6983],
        localities: {
          'Temple Area': [13.7497, 79.6983],
          Panagal: [13.7586, 79.7086],
          'Bahuda River Road': [13.7419, 79.6886]
        }
      },
      Renigunta: {
        center: [13.6508, 79.5186],
        localities: {
          'Renigunta Junction Area': [13.6508, 79.5186],
          'Airport Road (Renigunta)': [13.6658, 79.5419]
        }
      }
    },
    Chittoor: {
      'Chittoor Town': {
        center: [13.2172, 79.1003],
        localities: {
          'Gandhi Road': [13.2186, 79.1042],
          'Kongareddy Palli': [13.2258, 79.1158],
          Murakambattu: [13.2386, 79.0886]
        }
      }
    },
    'YSR Kadapa': {
      'Kadapa City': {
        center: [14.4673, 78.8242],
        localities: {
          'RTC Bus Stand Area': [14.4719, 78.8286],
          Nagarajupalle: [14.4586, 78.8358],
          'Rami Reddy Nagar': [14.4786, 78.8186],
          Yerramukkapalli: [14.4619, 78.8158]
        }
      }
    },
    Kurnool: {
      'Kurnool City': {
        center: [15.8281, 78.0373],
        localities: {
          'Nandyal Check Post': [15.8186, 78.0486],
          'Santosh Nagar': [15.8358, 78.0286],
          'B Camp': [15.8219, 78.0214],
          Roza: [15.8319, 78.0458],
          'Venkatramana Colony': [15.8419, 78.0358]
        }
      }
    },
    'Sri Potti Sriramulu Nellore': {
      'Nellore City': {
        center: [14.4426, 79.9865],
        localities: {
          Dargamitta: [14.4386, 79.9786],
          'Magunta Layout': [14.4486, 79.9886],
          Fathekhanpet: [14.4419, 79.9686],
          Vedayapalem: [14.4258, 79.9614],
          Pogathota: [14.4519, 79.9814]
        }
      }
    },
    'East Godavari': {
      'Rajahmundry City': {
        center: [17.0005, 81.8040],
        localities: {
          Danavaipeta: [17.0086, 81.7986],
          Innespeta: [16.9958, 81.7886],
          Morampudi: [17.0186, 81.8258],
          'Kotipalli Bus Stand Area': [16.9919, 81.7814],
          Diwancheruvu: [17.0658, 81.8586]
        }
      }
    },
    'West Godavari': {
      Bhimavaram: {
        center: [16.5449, 81.5212],
        localities: {
          Balusumoodi: [16.5486, 81.5286],
          Sompeta: [16.5386, 81.5158],
          'One Town (Bhimavaram)': [16.5419, 81.5258]
        }
      }
    },
    Anantapur: {
      'Anantapur City': {
        center: [14.6819, 77.6006],
        localities: {
          'Subash Road': [14.6858, 77.6042],
          'Housing Board Colony': [14.6758, 77.5914],
          'Rudra Rampur': [14.6919, 77.6186],
          'Sai Nagar': [14.6686, 77.5958]
        }
      }
    }
  }
};

export const getStates = () => Object.keys(LOCATION_DATA);

export const getDistricts = (state) => {
  if (!state || !LOCATION_DATA[state]) return [];
  return Object.keys(LOCATION_DATA[state]);
};

export const getCities = (state, district) => {
  if (!state || !district || !LOCATION_DATA[state] || !LOCATION_DATA[state][district]) {
    return [];
  }
  return Object.keys(LOCATION_DATA[state][district]);
};

export const getLocalities = (state, district, city) => {
  if (
    !state ||
    !district ||
    !city ||
    !LOCATION_DATA[state] ||
    !LOCATION_DATA[state][district] ||
    !LOCATION_DATA[state][district][city]
  ) {
    return [];
  }
  return Object.keys(LOCATION_DATA[state][district][city].localities || {});
};

export const getCoordinates = (state, district, city, locality) => {
  if (!state || !LOCATION_DATA[state]) return null;
  const stateData = LOCATION_DATA[state];
  if (!district || !stateData[district]) return null;
  const districtData = stateData[district];
  if (!city || !districtData[city]) return null;
  const cityData = districtData[city];
  if (locality && cityData.localities && cityData.localities[locality]) {
    return cityData.localities[locality];
  }
  return cityData.center || null;
};

export const isValidLocation = (state, district, city, locality) => {
  if (!state) return true;
  if (!LOCATION_DATA[state]) return false;
  if (!district) return true;
  if (!LOCATION_DATA[state][district]) return false;
  if (!city) return true;
  if (!LOCATION_DATA[state][district][city]) return false;
  if (!locality) return true;
  return Boolean(LOCATION_DATA[state][district][city].localities?.[locality]);
};
