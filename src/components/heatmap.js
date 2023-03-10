import React, { useEffect, useState, useMemo } from "react";
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { useSubscribe } from "@/hooks";


const geoUrl =
    "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/united-states/us-albers.json";

const Heatmap = () => {
    const [locToFreq, setLocToFreq] = useState([]);
    const [latLongs, setLatLongs] = useState([]);
    const [maxValue, setMaxValue] = useState(1);
    const wsParams = {
        query: {
            sql: "SELECT * FROM by_state_last_hour",
            cluster: "default"
        },
        config: {
            host: 'localhost:6876',
            auth: {
                user: 'materialize',
                password: 'test'
            }
        }
    }
    const { data, loading } = useSubscribe(wsParams);
    const stateMapping = require('../data/stateMapping.json');

    useEffect(() => {
        console.log('data');
        console.log(data);
        let rows = data["rows"];
                let max = Math.max.apply(Math, rows.map(function (row) { return row['count']; }))
                let locMap = rows.reduce(function (map, row) {
                    map[row['state']] = row['count'];
                    return map;
                }, {});
                setMaxValue(max);
                setLocToFreq(locMap);

                let latlongs = rows.map((row) => {
                    let latlong = stateMapping[row['state']];
                    return { locName: row['state'], lat: latlong["latitude"], lng: latlong["longitude"] }
                });
                setLatLongs(latlongs);
    }, [data, loading]);

    const popScale = useMemo(
        () => scaleLinear().domain([0, maxValue]).range([0, 24]),
        [maxValue]
    );

    return (
        <ComposableMap projection="geoAlbersUsa">
            <Geographies geography={geoUrl}>
                {({ geographies }) =>
                    geographies.map((geo) => (
                        <Geography key={geo.rsmKey} geography={geo} stroke="#aeaeb6" fill="#DDD" />
                    ))
                }
            </Geographies>
            {latLongs.map(({ locName, lng, lat }) => {
                let freq = locToFreq[locName];
                return (
                    <Marker key={locName} coordinates={[lng, lat]}>
                        <circle fill="#055C9D" stroke="#fff" strokeWidth={2} r={popScale(freq)} />
                    </Marker>
                );
            })}
        </ComposableMap>
    );
};

export default Heatmap;
