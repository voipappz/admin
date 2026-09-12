import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import * as d3 from 'd3';

const LogsBarChart = ({ logs, width = 800, height = 400 }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!logs || logs.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Group logs by hour
    const hourlyData = d3.rollup(
      logs,
      (group) => {
        const counts = {};
        group.forEach(log => {
          const facility = log.facility || 'unknown';
          counts[facility] = (counts[facility] || 0) + 1;
        });
        return counts;
      },
      (d) => {
        // Group by hour
        const timestamp = d.timestamp ? parseInt(d.timestamp) * 1000 : Date.parse(d.isodate);
        const date = new Date(timestamp);
        return d3.timeHour.floor(date).toISOString();
      }
    );

    // Convert to array format for D3
    const chartData = Array.from(hourlyData, ([hour, facilityCounts]) => ({
      hour: new Date(hour),
      ...facilityCounts,
      total: Object.values(facilityCounts).reduce((sum, count) => sum + count, 0)
    }));

    // Sort by time
    chartData.sort((a, b) => a.hour - b.hour);

    // Get all unique facilities
    const facilities = Array.from(new Set(logs.map(log => log.facility || 'unknown')));
    
    // Setup dimensions
    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const container = svg
      .attr("width", width)
      .attr("height", height);

    const g = container
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Setup scales
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.hour))
      .range([0, chartWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.total)])
      .range([chartHeight, 0]);

    const colorScale = d3.scaleOrdinal()
      .domain(facilities)
      .range(['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4']);

    // Create stack layout
    const stack = d3.stack()
      .keys(facilities)
      .value((d, key) => d[key] || 0);

    const stackedData = stack(chartData);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%H:%M")))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    g.append("g")
      .call(d3.axisLeft(yScale));

    // Add bars
    const groups = g.selectAll("g.layer")
      .data(stackedData)
      .enter().append("g")
      .attr("class", "layer")
      .style("fill", d => colorScale(d.key));

    groups.selectAll("rect")
      .data(d => d)
      .enter().append("rect")
      .attr("x", d => xScale(d.data.hour))
      .attr("y", d => yScale(d[1]))
      .attr("height", d => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth())
      .on("mouseover", function(event, d) {
        const facilityName = d3.select(this.parentNode).datum().key;
        const count = d[1] - d[0];
        
        // Simple tooltip
        d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .html(`${facilityName}: ${count} logs<br/>${d3.timeFormat("%H:%M")(d.data.hour)}`);
      })
      .on("mouseout", function() {
        d3.selectAll(".tooltip").remove();
      });

    // Add legend
    const legend = g.selectAll(".legend")
      .data(facilities)
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(${chartWidth + 10},${i * 20})`);

    legend.append("rect")
      .attr("x", 0)
      .attr("width", 15)
      .attr("height", 15)
      .style("fill", colorScale);

    legend.append("text")
      .attr("x", 20)
      .attr("y", 7)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .text(d => d);

    // Add title
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("System Logs by Hour and Facility");

  }, [logs, width, height]);

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ width: '100%', minHeight: '400px' }}></svg>
    </Box>
  );
};

export default LogsBarChart;