<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    
    <xsl:output method="html" encoding="UTF-8" indent="yes"/>
    
    <!-- Suppress default text node output -->
    <xsl:template match="text()" priority="-1"/>
    
    <!-- Handle WMO collect wrapper - namespace independent -->
    <xsl:template match="*[local-name()='meteorologicalInformation']" priority="0.5">
        <xsl:apply-templates/>
    </xsl:template>
    
    <xsl:template match="/">
        <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&amp;display=swap" rel="stylesheet"/>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        line-height: 1.6;
                        color: rgba(0, 0, 0, 0.87);
                        background-color: #fafafa;
                        padding: 16px;
                    }
                    
                    /* Typography */
                    h1 { 
                        font-size: 2.125rem;
                        font-weight: 400;
                        letter-spacing: -0.5px;
                        margin-bottom: 16px;
                        color: #1976d2;
                    }
                    h2 { 
                        font-size: 1.5rem;
                        font-weight: 500;
                        margin: 16px 0 12px 0;
                        color: rgba(0, 0, 0, 0.87);
                    }
                    h3 { 
                        font-size: 1.25rem;
                        font-weight: 500;
                        margin: 12px 0 8px 0;
                        color: rgba(0, 0, 0, 0.7);
                    }
                    
                    /* Cards and Containers */
                    .header { 
                        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
                        color: white;
                        padding: 24px;
                        border-radius: 8px;
                        margin-bottom: 24px;
                        box-shadow: 0 3px 5px rgba(0,0,0,0.2);
                    }
                    .header h1 { color: white; margin: 0; }
                    
                    .section { 
                        background: white;
                        margin-bottom: 16px;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
                    }
                    .section h2 {
                        margin-top: 0;
                        padding-bottom: 12px;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
                    }
                    
                    /* Fields */
                    .field { 
                        display: flex;
                        padding: 8px 0;
                        align-items: baseline;
                    }
                    .label { 
                        font-weight: 500;
                        color: rgba(0, 0, 0, 0.6);
                        min-width: 160px;
                        font-size: 0.875rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .value { 
                        color: rgba(0, 0, 0, 0.87);
                        font-weight: 400;
                        font-size: 1rem;
                    }
                    
                    /* Tables */
                    .obs-table { 
                        width: 100%;
                        border-collapse: collapse;
                        margin: 16px 0;
                        background: white;
                    }
                    .obs-table th { 
                        background-color: #1976d2;
                        color: white;
                        padding: 12px 16px;
                        text-align: left;
                        font-weight: 500;
                        font-size: 0.875rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .obs-table td { 
                        padding: 12px 16px;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
                    }
                    .obs-table tr:last-child td { border-bottom: none; }
                    .obs-table tr:hover { background-color: rgba(25, 118, 210, 0.04); }
                    
                    /* Forecast Periods */
                    .forecast-period { 
                        background: linear-gradient(to right, #e3f2fd 0%, #bbdefb 100%);
                        padding: 20px;
                        margin: 16px 0;
                        border-radius: 8px;
                        border-left: 4px solid #1976d2;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                    }
                    .forecast-period h2 {
                        color: #1565c0;
                        border-bottom: 1px solid rgba(21, 101, 192, 0.3);
                    }
                    
                    /* Change Groups */
                    .change-group { 
                        background: #fff3e0;
                        padding: 16px;
                        margin: 12px 0;
                        border-radius: 8px;
                        border-left: 4px solid #ff9800;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    }
                    .change-group h2 {
                        color: #e65100;
                        font-size: 1.125rem;
                        border-bottom: 1px solid rgba(230, 81, 0, 0.2);
                    }
                    
                    /* Warnings and Alerts */
                    .warning { 
                        background-color: #fff8e1;
                        border-left: 4px solid #ffa726;
                        padding: 16px;
                        margin: 16px 0;
                        border-radius: 4px;
                    }
                    .sigmet { 
                        background-color: #ffebee;
                        border-left: 4px solid #f44336;
                        padding: 16px;
                        margin: 16px 0;
                        border-radius: 4px;
                    }
                    
                    /* Chips/Tags */
                    .chip {
                        display: inline-block;
                        padding: 4px 12px;
                        margin: 4px;
                        background-color: #e0e0e0;
                        border-radius: 16px;
                        font-size: 0.875rem;
                        font-weight: 500;
                    }
                    
                    /* Utility */
                    .divider {
                        height: 1px;
                        background-color: rgba(0, 0, 0, 0.12);
                        margin: 16px 0;
                    }
                </style>
            </head>
            <body>
                <xsl:apply-templates/>
            </body>
        </html>
    </xsl:template>
    
    <!-- Debug: catch any unmatched root elements -->
    <xsl:template match="/*" priority="-0.5">
        <div class="warning">
            <h2>Debug Info</h2>
            <div class="field">
                <span class="label">Root Element:</span>
                <span class="value"><xsl:value-of select="local-name()"/></span>
            </div>
            <div class="field">
                <span class="label">Namespace:</span>
                <span class="value"><xsl:value-of select="namespace-uri()"/></span>
            </div>
            <div class="field">
                <span class="label">Child Elements:</span>
                <span class="value"><xsl:for-each select="*"><xsl:value-of select="local-name()"/><xsl:text>, </xsl:text></xsl:for-each></span>
            </div>
        </div>
    </xsl:template>
    
    <!-- METAR Template - Namespace Independent (no mode for top-level matching) -->
    <xsl:template match="*[(local-name() = 'METAR' or local-name() = 'SPECI') and (namespace-uri() = 'http://icao.int/iwxxm/2023-1' or namespace-uri() = 'http://icao.int/iwxxm/3.0' or namespace-uri() = 'http://icao.int/iwxxm/2.1')]" priority="1">
        <div class="header">
            <h1>
                <xsl:choose>
                    <xsl:when test="local-name() = 'SPECI'">SPECI - Special Meteorological Report</xsl:when>
                    <xsl:otherwise>METAR - Meteorological Aerodrome Report</xsl:otherwise>
                </xsl:choose>
            </h1>
        </div>
        
        <div class="section">
            <h2>Report Information</h2>
            <div class="field">
                <span class="label">Status:</span>
                <span class="value"><xsl:value-of select="@reportStatus | @status"/></span>
            </div>
            <xsl:if test="@permissibleUsage">
                <div class="field">
                    <span class="label">Permissible Usage:</span>
                    <span class="value"><xsl:value-of select="@permissibleUsage"/></span>
                </div>
            </xsl:if>
            <xsl:if test="@automatedStation">
                <div class="field">
                    <span class="label">Automated Station:</span>
                    <span class="value"><xsl:value-of select="@automatedStation"/></span>
                </div>
            </xsl:if>
            <div class="field">
                <span class="label">Issue Time:</span>
                <span class="value"><xsl:value-of select="*[local-name()='issueTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/></span>
            </div>
            <div class="field">
                <span class="label">Observation Time:</span>
                <span class="value"><xsl:value-of select="*[local-name()='observationTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/></span>
            </div>
            <div class="field">
                <span class="label">Aerodrome:</span>
                <span class="value">
                    <xsl:value-of select=".//*[local-name()='designator']"/>
                    <xsl:if test=".//*[local-name()='name' and namespace-uri()='http://www.aixm.aero/schema/5.1.1']"> - <xsl:value-of select=".//*[local-name()='name' and namespace-uri()='http://www.aixm.aero/schema/5.1.1']"/></xsl:if>
                </span>
            </div>
            <xsl:if test=".//*[local-name()='designatorIATA']">
                <div class="field">
                    <span class="label">IATA Code:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='designatorIATA']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='pos']">
                <xsl:variable name="coords" select=".//*[local-name()='pos']"/>
                <xsl:variable name="lat" select="substring-before($coords, ' ')"/>
                <xsl:variable name="lon" select="substring-after($coords, ' ')"/>
                <div class="field">
                    <span class="label">Coordinates:</span>
                    <span class="value">
                        <xsl:value-of select="format-number($lat, '0.00')"/>°
                        <xsl:choose>
                            <xsl:when test="$lat >= 0">N</xsl:when>
                            <xsl:otherwise>S</xsl:otherwise>
                        </xsl:choose>
                        , 
                        <xsl:value-of select="format-number($lon, '0.00')"/>°
                        <xsl:choose>
                            <xsl:when test="$lon >= 0">E</xsl:when>
                            <xsl:otherwise>W</xsl:otherwise>
                        </xsl:choose>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='fieldElevation']">
                <div class="field">
                    <span class="label">Elevation:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='fieldElevation']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select=".//*[local-name()='fieldElevation']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
        </div>
        
        <xsl:apply-templates select="*[local-name()='observation']" mode="metar-obs"/>
        <xsl:apply-templates select=".//*[local-name()='trendForecast']"/>
    </xsl:template>
    
    
    <!-- METAR Observation - Updated for IWXXM 3.0 -->
    <xsl:template match="*[local-name()='observation']" mode="metar-obs">
        <div class="section">
            <h2>Current Observation</h2>
            <!-- Handle both IWXXM 3.0 (direct) and older versions (result wrapper) -->
            <xsl:choose>
                <xsl:when test="*[local-name()='MeteorologicalAerodromeObservation']">
                    <xsl:apply-templates select="*[local-name()='MeteorologicalAerodromeObservation']" mode="metar-obs-data"/>
                </xsl:when>
                <xsl:when test=".//*[local-name()='result']">
                    <xsl:apply-templates select=".//*[local-name()='result']"/>
                </xsl:when>
            </xsl:choose>
        </div>
    </xsl:template>
    
    <!-- METAR Observation Data - Direct from MeteorologicalAerodromeObservation -->
    <xsl:template match="*[local-name()='MeteorologicalAerodromeObservation']" mode="metar-obs-data">
        <xsl:variable name="obs" select="."/>
        
        <div class="field">
            <span class="label">Cloud and Visibility OK (CAVOK):</span>
            <span class="value">
                <xsl:choose>
                    <xsl:when test="@cloudAndVisibilityOK = 'true'">Yes</xsl:when>
                    <xsl:otherwise>No</xsl:otherwise>
                </xsl:choose>
            </span>
        </div>
        
        <!-- Surface Wind -->
        <xsl:if test="$obs/*[local-name()='surfaceWind']">
            <h3>Surface Wind</h3>
            <xsl:variable name="wind" select="$obs/*[local-name()='surfaceWind']//*[local-name()='AerodromeSurfaceWind']"/>
            
            <xsl:if test="$wind/@variableWindDirection = 'true'">
                <div class="field">
                    <span class="label">Variable Wind Direction:</span>
                    <span class="value">Yes</span>
                </div>
            </xsl:if>
            
            <xsl:if test="$wind/*[local-name()='meanWindDirection']">
                <div class="field">
                    <span class="label">Mean Wind Direction:</span>
                    <span class="value">
                        <xsl:value-of select="$wind/*[local-name()='meanWindDirection']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$wind/*[local-name()='meanWindDirection']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
            
            <div class="field">
                <span class="label">Mean Wind Speed:</span>
                <span class="value">
                    <xsl:if test="$wind/*[local-name()='meanWindSpeedOperator']">
                        <xsl:value-of select="$wind/*[local-name()='meanWindSpeedOperator']"/>
                        <xsl:text> </xsl:text>
                    </xsl:if>
                    <xsl:value-of select="$wind/*[local-name()='meanWindSpeed']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$wind/*[local-name()='meanWindSpeed']/@*[local-name()='uom']"/>
                </span>
            </div>
            
            <xsl:if test="$wind/*[local-name()='windGustSpeed']">
                <div class="field">
                    <span class="label">Wind Gust Speed:</span>
                    <span class="value">
                        <xsl:if test="$wind/*[local-name()='windGustSpeedOperator']">
                            <xsl:value-of select="$wind/*[local-name()='windGustSpeedOperator']"/>
                            <xsl:text> </xsl:text>
                        </xsl:if>
                        <xsl:value-of select="$wind/*[local-name()='windGustSpeed']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$wind/*[local-name()='windGustSpeed']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$wind/*[local-name()='extremeClockwiseWindDirection']">
                <div class="field">
                    <span class="label">Wind Direction Variation:</span>
                    <span class="value">
                        <xsl:value-of select="$wind/*[local-name()='extremeCounterClockwiseWindDirection']"/>° V 
                        <xsl:value-of select="$wind/*[local-name()='extremeClockwiseWindDirection']"/>°
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Visibility -->
        <xsl:if test="$obs/*[local-name()='visibility']">
            <h3>Visibility</h3>
            <xsl:variable name="vis" select="$obs/*[local-name()='visibility']/*[local-name()='AerodromeHorizontalVisibility']"/>
            
            <div class="field">
                <span class="label">Prevailing Visibility:</span>
                <span class="value">
                    <xsl:if test="$vis/*[local-name()='prevailingVisibilityOperator']">
                        <xsl:value-of select="$vis/*[local-name()='prevailingVisibilityOperator']"/>
                        <xsl:text> </xsl:text>
                    </xsl:if>
                    <xsl:value-of select="$vis/*[local-name()='prevailingVisibility']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$vis/*[local-name()='prevailingVisibility']/@*[local-name()='uom']"/>
                </span>
            </div>
            
            <xsl:if test="$vis/*[local-name()='minimumVisibility']">
                <div class="field">
                    <span class="label">Minimum Visibility:</span>
                    <span class="value">
                        <xsl:value-of select="$vis/*[local-name()='minimumVisibility']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$vis/*[local-name()='minimumVisibility']/@*[local-name()='uom']"/>
                        <xsl:if test="$vis/*[local-name()='minimumVisibilityDirection']">
                            <xsl:text> (Direction: </xsl:text>
                            <xsl:value-of select="$vis/*[local-name()='minimumVisibilityDirection']"/>°)
                        </xsl:if>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Present Weather -->
        <xsl:if test="$obs/*[local-name()='presentWeather']">
            <h3>Present Weather</h3>
            <xsl:for-each select="$obs/*[local-name()='presentWeather']">
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
        
        <!-- Cloud -->
        <xsl:if test="$obs/*[local-name()='cloud']">
            <h3>Cloud</h3>
            <xsl:apply-templates select="$obs/*[local-name()='cloud']"/>
        </xsl:if>
        
        <!-- Temperature and Dewpoint -->
        <xsl:if test="$obs/*[local-name()='airTemperature']">
            <h3>Temperature</h3>
            <div class="field">
                <span class="label">Air Temperature:</span>
                <span class="value">
                    <xsl:value-of select="$obs/*[local-name()='airTemperature']"/> 
                    <xsl:value-of select="$obs/*[local-name()='airTemperature']/@*[local-name()='uom']"/>
                </span>
            </div>
            <xsl:if test="$obs/*[local-name()='dewpointTemperature']">
                <div class="field">
                    <span class="label">Dewpoint Temperature:</span>
                    <span class="value">
                        <xsl:value-of select="$obs/*[local-name()='dewpointTemperature']"/> 
                        <xsl:value-of select="$obs/*[local-name()='dewpointTemperature']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- QNH Pressure -->
        <xsl:if test="$obs/*[local-name()='qnh']">
            <h3>Atmospheric Pressure</h3>
            <div class="field">
                <span class="label">QNH (Altimeter Setting):</span>
                <span class="value">
                    <xsl:value-of select="$obs/*[local-name()='qnh']"/> 
                    <xsl:value-of select="$obs/*[local-name()='qnh']/@*[local-name()='uom']"/>
                </span>
            </div>
        </xsl:if>
        
        <!-- Recent Weather -->
        <xsl:if test="$obs/*[local-name()='recentWeather']">
            <h3>Recent Weather</h3>
            <xsl:for-each select="$obs/*[local-name()='recentWeather']">
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
        
        <!-- Runway Visual Range (RVR) -->
        <xsl:if test="$obs/*[local-name()='rvr']">
            <h3>Runway Visual Range (RVR)</h3>
            <table class="obs-table">
                <thead>
                    <tr>
                        <th>Runway</th>
                        <th>Mean RVR</th>
                        <th>Tendency</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="$obs/*[local-name()='rvr']">
                        <xsl:variable name="rvrData" select=".//*[local-name()='AerodromeRunwayVisualRange']"/>
                        <tr>
                            <td><xsl:value-of select="$rvrData/*[local-name()='runway']//*[local-name()='designator']"/></td>
                            <td>
                                <xsl:if test="$rvrData/*[local-name()='meanRVROperator']">
                                    <xsl:value-of select="$rvrData/*[local-name()='meanRVROperator']"/>
                                    <xsl:text> </xsl:text>
                                </xsl:if>
                                <xsl:value-of select="$rvrData/*[local-name()='meanRVR']"/>
                                <xsl:text> </xsl:text>
                                <xsl:value-of select="$rvrData/*[local-name()='meanRVR']/@*[local-name()='uom']"/>
                            </td>
                            <td><xsl:value-of select="$rvrData/@pastTendency"/></td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
        
        <!-- Wind Shear -->
        <xsl:if test="$obs/*[local-name()='windShear']">
            <h3>Wind Shear</h3>
            <xsl:variable name="ws" select="$obs/*[local-name()='windShear']//*[local-name()='AerodromeWindShear']"/>
            <div class="warning">
                <xsl:choose>
                    <xsl:when test="$ws/@allRunways = 'true'">
                        <strong>Wind shear reported on ALL RUNWAYS</strong>
                    </xsl:when>
                    <xsl:otherwise>
                        <strong>Wind shear reported on runway(s): </strong>
                        <xsl:for-each select="$ws/*[local-name()='runway']">
                            <xsl:value-of select=".//*[local-name()='designator']"/>
                            <xsl:if test="position() != last()">, </xsl:if>
                        </xsl:for-each>
                    </xsl:otherwise>
                </xsl:choose>
            </div>
        </xsl:if>
        
        <!-- Sea Conditions -->
        <xsl:if test="$obs/*[local-name()='seaCondition']">
            <h3>Sea Conditions</h3>
            <xsl:variable name="sea" select="$obs/*[local-name()='seaCondition']//*[local-name()='AerodromeSeaCondition']"/>
            
            <div class="field">
                <span class="label">Sea Surface Temperature:</span>
                <span class="value">
                    <xsl:value-of select="$sea/*[local-name()='seaSurfaceTemperature']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$sea/*[local-name()='seaSurfaceTemperature']/@*[local-name()='uom']"/>
                </span>
            </div>
            
            <xsl:if test="$sea/*[local-name()='significantWaveHeight']">
                <div class="field">
                    <span class="label">Significant Wave Height:</span>
                    <span class="value">
                        <xsl:value-of select="$sea/*[local-name()='significantWaveHeight']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$sea/*[local-name()='significantWaveHeight']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$sea/*[local-name()='seaState']">
                <div class="field">
                    <span class="label">Sea State:</span>
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="$sea/*[local-name()='seaState']/@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Runway State -->
        <xsl:if test="$obs/*[local-name()='runwayState']">
            <h3>Runway State</h3>
            <table class="obs-table">
                <thead>
                    <tr>
                        <th>Runway</th>
                        <th>Deposit Type</th>
                        <th>Contamination</th>
                        <th>Depth</th>
                        <th>Friction/Braking</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="$obs/*[local-name()='runwayState']">
                        <xsl:variable name="rs" select=".//*[local-name()='AerodromeRunwayState']"/>
                        <tr>
                            <td>
                                <xsl:choose>
                                    <xsl:when test="$rs/@allRunways = 'true'">ALL RUNWAYS</xsl:when>
                                    <xsl:otherwise>
                                        <xsl:value-of select="$rs/*[local-name()='runway']//*[local-name()='designator']"/>
                                    </xsl:otherwise>
                                </xsl:choose>
                                <xsl:if test="$rs/@cleared = 'true'"> (CLEARED)</xsl:if>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='depositType']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='contamination']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:value-of select="$rs/*[local-name()='depthOfDeposit']"/>
                                <xsl:if test="$rs/*[local-name()='depthOfDeposit']/@*[local-name()='uom']">
                                    <xsl:text> </xsl:text>
                                    <xsl:value-of select="$rs/*[local-name()='depthOfDeposit']/@*[local-name()='uom']"/>
                                </xsl:if>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='estimatedSurfaceFrictionOrBrakingAction']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>
    
    <!-- METAR Result - Comprehensive -->
    <xsl:template match="*[local-name()='result']">
        <xsl:variable name="obs" select="*[local-name()='MeteorologicalAerodromeObservation']"/>
        
        <div class="field">
            <span class="label">Cloud and Visibility OK (CAVOK):</span>
            <span class="value">
                <xsl:choose>
                    <xsl:when test="$obs/@cloudAndVisibilityOK = 'true'">Yes</xsl:when>
                    <xsl:otherwise>No</xsl:otherwise>
                </xsl:choose>
            </span>
        </div>
        
        <!-- Surface Wind -->
        <xsl:if test="$obs/*[local-name()='surfaceWind']">
            <h3>Surface Wind</h3>
            <xsl:variable name="wind" select="$obs/*[local-name()='surfaceWind']//*[local-name()='AerodromeSurfaceWind']"/>
            
            <xsl:if test="$wind/@variableWindDirection = 'true'">
                <div class="field">
                    <span class="label">Variable Wind Direction:</span>
                    <span class="value">Yes</span>
                </div>
            </xsl:if>
            
            <xsl:if test="$wind/*[local-name()='meanWindDirection']">
                <div class="field">
                    <span class="label">Mean Wind Direction:</span>
                    <span class="value">
                        <xsl:value-of select="$wind/*[local-name()='meanWindDirection']"/>°
                    </span>
                </div>
            </xsl:if>
            
            <div class="field">
                <span class="label">Mean Wind Speed:</span>
                <span class="value">
                    <xsl:if test="$wind/*[local-name()='meanWindSpeedOperator']">
                        <xsl:value-of select="$wind/*[local-name()='meanWindSpeedOperator']"/>
                        <xsl:text> </xsl:text>
                    </xsl:if>
                    <xsl:value-of select="$wind/*[local-name()='meanWindSpeed']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$wind/*[local-name()='meanWindSpeed']/@uom"/>
                </span>
            </div>
            
            <xsl:if test="$wind/*[local-name()='windGustSpeed']">
                <div class="field">
                    <span class="label">Wind Gust Speed:</span>
                    <span class="value">
                        <xsl:if test="$wind/*[local-name()='windGustSpeedOperator']">
                            <xsl:value-of select="$wind/*[local-name()='windGustSpeedOperator']"/>
                            <xsl:text> </xsl:text>
                        </xsl:if>
                        <xsl:value-of select="$wind/*[local-name()='windGustSpeed']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$wind/*[local-name()='windGustSpeed']/@uom"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$wind/*[local-name()='extremeClockwiseWindDirection']">
                <div class="field">
                    <span class="label">Wind Direction Variation:</span>
                    <span class="value">
                        <xsl:value-of select="$wind/*[local-name()='extremeCounterClockwiseWindDirection']"/>° V 
                        <xsl:value-of select="$wind/*[local-name()='extremeClockwiseWindDirection']"/>°
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Visibility -->
        <xsl:if test="$obs/*[local-name()='visibility']">
            <h3>Visibility</h3>
            <xsl:variable name="vis" select="$obs/*[local-name()='visibility']/*[local-name()='AerodromeHorizontalVisibility']"/>
            
            <div class="field">
                <span class="label">Prevailing Visibility:</span>
                <span class="value">
                    <xsl:if test="$vis/*[local-name()='prevailingVisibilityOperator']">
                        <xsl:value-of select="$vis/*[local-name()='prevailingVisibilityOperator']"/>
                        <xsl:text> </xsl:text>
                    </xsl:if>
                    <xsl:value-of select="$vis/*[local-name()='prevailingVisibility']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$vis/*[local-name()='prevailingVisibility']/@uom | $vis/*[local-name()='prevailingVisibility']/@uom | $vis/*[local-name()='prevailingVisibility']/@uom"/>
                </span>
            </div>
            
            <xsl:if test="$vis/*[local-name()='minimumVisibility']">
                <div class="field">
                    <span class="label">Minimum Visibility:</span>
                    <span class="value">
                        <xsl:value-of select="$vis/*[local-name()='minimumVisibility']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$vis/*[local-name()='minimumVisibility']/@uom | $vis/*[local-name()='minimumVisibility']/@uom | $vis/*[local-name()='minimumVisibility']/@uom"/>
                        <xsl:if test="$vis/*[local-name()='minimumVisibilityDirection']">
                            <xsl:text> (Direction: </xsl:text>
                            <xsl:value-of select="$vis/*[local-name()='minimumVisibilityDirection']"/>°)
                        </xsl:if>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Runway Visual Range (RVR) -->
        <xsl:if test="$obs/*[local-name()='rvr']">
            <h3>Runway Visual Range (RVR)</h3>
            <table class="obs-table">
                <thead>
                    <tr>
                        <th>Runway</th>
                        <th>Mean RVR</th>
                        <th>Tendency</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="$obs/*[local-name()='rvr']">
                        <xsl:variable name="rvrData" select=".//*[local-name()='AerodromeRunwayVisualRange'] | .//*[local-name()='AerodromeRunwayVisualRange'] | .//*[local-name()='AerodromeRunwayVisualRange']"/>
                        <tr>
                            <td><xsl:value-of select="$rvrData/*[local-name()='runway']//*[local-name()='designator'] | $rvrData/*[local-name()='runway']//*[local-name()='designator'] | $rvrData/*[local-name()='runway']//*[local-name()='designator']"/></td>
                            <td>
                                <xsl:if test="$rvrData/*[local-name()='meanRVROperator']">
                                    <xsl:value-of select="$rvrData/*[local-name()='meanRVROperator']"/>
                                    <xsl:text> </xsl:text>
                                </xsl:if>
                                <xsl:value-of select="$rvrData/*[local-name()='meanRVR']"/>
                                <xsl:text> </xsl:text>
                                <xsl:value-of select="$rvrData/*[local-name()='meanRVR']/@uom | $rvrData/*[local-name()='meanRVR']/@uom | $rvrData/*[local-name()='meanRVR']/@uom"/>
                            </td>
                            <td><xsl:value-of select="$rvrData/@pastTendency"/></td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
        
        <!-- Present Weather -->
        <xsl:if test="$obs/*[local-name()='presentWeather']">
            <h3>Present Weather</h3>
            <xsl:for-each select="$obs/*[local-name()='presentWeather']">
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
        
        <!-- Cloud -->
        <xsl:if test="$obs/*[local-name()='cloud']">
            <h3>Cloud</h3>
            <xsl:apply-templates select="$obs/*[local-name()='cloud']"/>
        </xsl:if>
        
        <!-- Temperature and Dewpoint -->
        <xsl:if test="$obs/*[local-name()='airTemperature']">
            <h3>Temperature</h3>
            <div class="field">
                <span class="label">Air Temperature:</span>
                <span class="value">
                    <xsl:value-of select="$obs/*[local-name()='airTemperature']"/> 
                    <xsl:value-of select="$obs/*[local-name()='airTemperature']/@uom | $obs/*[local-name()='airTemperature']/@uom | $obs/*[local-name()='airTemperature']/@uom"/>
                </span>
            </div>
            <xsl:if test="$obs/*[local-name()='dewpointTemperature']">
                <div class="field">
                    <span class="label">Dewpoint Temperature:</span>
                    <span class="value">
                        <xsl:value-of select="$obs/*[local-name()='dewpointTemperature']"/> 
                        <xsl:value-of select="$obs/*[local-name()='dewpointTemperature']/@uom | $obs/*[local-name()='dewpointTemperature']/@uom | $obs/*[local-name()='dewpointTemperature']/@uom"/>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- QNH Pressure -->
        <xsl:if test="$obs/*[local-name()='qnh']">
            <h3>Atmospheric Pressure</h3>
            <div class="field">
                <span class="label">QNH (Altimeter Setting):</span>
                <span class="value">
                    <xsl:value-of select="$obs/*[local-name()='qnh']"/> 
                    <xsl:value-of select="$obs/*[local-name()='qnh']/@uom | $obs/*[local-name()='qnh']/@uom | $obs/*[local-name()='qnh']/@uom"/>
                </span>
            </div>
        </xsl:if>
        
        <!-- Recent Weather -->
        <xsl:if test="$obs/*[local-name()='recentWeather']">
            <h3>Recent Weather</h3>
            <xsl:for-each select="$obs/*[local-name()='recentWeather']">
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
        
        <!-- Wind Shear -->
        <xsl:if test="$obs/*[local-name()='windShear']">
            <h3>Wind Shear</h3>
            <xsl:variable name="ws" select="$obs/*[local-name()='windShear']//*[local-name()='AerodromeWindShear'] | $obs/*[local-name()='windShear']//*[local-name()='AerodromeWindShear'] | $obs/*[local-name()='windShear']//*[local-name()='AerodromeWindShear']"/>
            <div class="warning">
                <xsl:choose>
                    <xsl:when test="$ws/@allRunways = 'true'">
                        <strong>Wind shear reported on ALL RUNWAYS</strong>
                    </xsl:when>
                    <xsl:otherwise>
                        <strong>Wind shear reported on runway(s): </strong>
                        <xsl:for-each select="$ws/*[local-name()='runway'] | $ws/*[local-name()='runway'] | $ws/*[local-name()='runway']">
                            <xsl:value-of select=".//*[local-name()='designator']"/>
                            <xsl:if test="position() != last()">, </xsl:if>
                        </xsl:for-each>
                    </xsl:otherwise>
                </xsl:choose>
            </div>
        </xsl:if>
        
        <!-- Sea Conditions -->
        <xsl:if test="$obs/*[local-name()='seaCondition']">
            <h3>Sea Conditions</h3>
            <xsl:variable name="sea" select="$obs/*[local-name()='seaCondition']//*[local-name()='AerodromeSeaCondition'] | $obs/*[local-name()='seaCondition']//*[local-name()='AerodromeSeaCondition'] | $obs/*[local-name()='seaCondition']//*[local-name()='AerodromeSeaCondition']"/>
            
            <div class="field">
                <span class="label">Sea Surface Temperature:</span>
                <span class="value">
                    <xsl:value-of select="$sea/*[local-name()='seaSurfaceTemperature'] | $sea/*[local-name()='seaSurfaceTemperature'] | $sea/*[local-name()='seaSurfaceTemperature']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$sea/*[local-name()='seaSurfaceTemperature']/@uom | $sea/*[local-name()='seaSurfaceTemperature']/@uom | $sea/*[local-name()='seaSurfaceTemperature']/@uom"/>
                </span>
            </div>
            
            <xsl:if test="$sea/*[local-name()='significantWaveHeight'] | $sea/*[local-name()='significantWaveHeight'] | $sea/*[local-name()='significantWaveHeight']">
                <div class="field">
                    <span class="label">Significant Wave Height:</span>
                    <span class="value">
                        <xsl:value-of select="$sea/*[local-name()='significantWaveHeight'] | $sea/*[local-name()='significantWaveHeight'] | $sea/*[local-name()='significantWaveHeight']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$sea/*[local-name()='significantWaveHeight']/@uom | $sea/*[local-name()='significantWaveHeight']/@uom | $sea/*[local-name()='significantWaveHeight']/@uom"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$sea/*[local-name()='seaState'] | $sea/*[local-name()='seaState'] | $sea/*[local-name()='seaState']">
                <div class="field">
                    <span class="label">Sea State:</span>
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="$sea/*[local-name()='seaState']/@*[local-name()='href'] | $sea/*[local-name()='seaState']/@*[local-name()='href'] | $sea/*[local-name()='seaState']/@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <!-- Runway State -->
        <xsl:if test="$obs/*[local-name()='runwayState']">
            <h3>Runway State</h3>
            <table class="obs-table">
                <thead>
                    <tr>
                        <th>Runway</th>
                        <th>Deposit Type</th>
                        <th>Contamination</th>
                        <th>Depth</th>
                        <th>Friction/Braking</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="$obs/*[local-name()='runwayState']">
                        <xsl:variable name="rs" select=".//*[local-name()='AerodromeRunwayState'] | .//*[local-name()='AerodromeRunwayState'] | .//*[local-name()='AerodromeRunwayState']"/>
                        <tr>
                            <td>
                                <xsl:choose>
                                    <xsl:when test="$rs/@allRunways = 'true'">ALL RUNWAYS</xsl:when>
                                    <xsl:otherwise>
                                        <xsl:value-of select="$rs/*[local-name()='runway']//*[local-name()='designator'] | $rs/*[local-name()='runway']//*[local-name()='designator'] | $rs/*[local-name()='runway']//*[local-name()='designator']"/>
                                    </xsl:otherwise>
                                </xsl:choose>
                                <xsl:if test="$rs/@cleared = 'true'"> (CLEARED)</xsl:if>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='depositType']/@*[local-name()='href'] | $rs/*[local-name()='depositType']/@*[local-name()='href'] | $rs/*[local-name()='depositType']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='contamination']/@*[local-name()='href'] | $rs/*[local-name()='contamination']/@*[local-name()='href'] | $rs/*[local-name()='contamination']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:value-of select="$rs/*[local-name()='depthOfDeposit'] | $rs/*[local-name()='depthOfDeposit'] | $rs/*[local-name()='depthOfDeposit']"/>
                                <xsl:if test="$rs/*[local-name()='depthOfDeposit']/@uom | $rs/*[local-name()='depthOfDeposit']/@uom | $rs/*[local-name()='depthOfDeposit']/@uom">
                                    <xsl:text> </xsl:text>
                                    <xsl:value-of select="$rs/*[local-name()='depthOfDeposit']/@uom | $rs/*[local-name()='depthOfDeposit']/@uom | $rs/*[local-name()='depthOfDeposit']/@uom"/>
                                </xsl:if>
                            </td>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$rs/*[local-name()='estimatedSurfaceFrictionOrBrakingAction']/@*[local-name()='href'] | $rs/*[local-name()='estimatedSurfaceFrictionOrBrakingAction']/@*[local-name()='href'] | $rs/*[local-name()='estimatedSurfaceFrictionOrBrakingAction']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>
    
    <!-- Trend Forecast Template - Namespace Independent -->
    <xsl:template match="*[local-name()='trendForecast']">
        <div class="forecast-period">
            <h2>Trend Forecast</h2>
            <xsl:variable name="trend" select=".//*[local-name()='MeteorologicalAerodromeTrendForecast']"/>
            
            <div class="field">
                <span class="label">Change Indicator:</span>
                <span class="value"><xsl:value-of select="$trend/@changeIndicator"/></span>
            </div>
            
            <xsl:if test="$trend/@cloudAndVisibilityOK = 'true'">
                <div class="field">
                    <span class="label">CAVOK:</span>
                    <span class="value">Yes</span>
                </div>
            </xsl:if>
            
            <xsl:if test="$trend/*[local-name()='phenomenonTime'] | $trend/*[local-name()='phenomenonTime'] | $trend/*[local-name()='phenomenonTime']">
                <div class="field">
                    <span class="label">Valid Time:</span>
                    <span class="value">
                        <xsl:choose>
                            <xsl:when test="$trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']">
                                <xsl:value-of select="$trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition']"/> to 
                                <xsl:value-of select="$trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition']"/>
                            </xsl:when>
                            <xsl:otherwise>
                                <xsl:value-of select="$trend/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $trend/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition']"/>
                            </xsl:otherwise>
                        </xsl:choose>
                        <xsl:if test="$trend/*[local-name()='timeIndicator'] | $trend/*[local-name()='timeIndicator'] | $trend/*[local-name()='timeIndicator']">
                            <xsl:text> (</xsl:text>
                            <xsl:value-of select="$trend/*[local-name()='timeIndicator'] | $trend/*[local-name()='timeIndicator'] | $trend/*[local-name()='timeIndicator']"/>
                            <xsl:text>)</xsl:text>
                        </xsl:if>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$trend/*[local-name()='surfaceWind'] | $trend/*[local-name()='surfaceWind'] | $trend/*[local-name()='surfaceWind']">
                <h3>Surface Wind</h3>
                <xsl:variable name="twind" select="$trend/*[local-name()='surfaceWind']//*[local-name()='AerodromeSurfaceWindTrendForecast'] | $trend/*[local-name()='surfaceWind']//*[local-name()='AerodromeSurfaceWindTrendForecast'] | $trend/*[local-name()='surfaceWind']//*[local-name()='AerodromeSurfaceWindTrendForecast']"/>
                <div class="field">
                    <span class="label">Direction:</span>
                    <span class="value"><xsl:value-of select="$twind/*[local-name()='meanWindDirection'] | $twind/*[local-name()='meanWindDirection'] | $twind/*[local-name()='meanWindDirection']"/>°</span>
                </div>
                <div class="field">
                    <span class="label">Speed:</span>
                    <span class="value">
                        <xsl:value-of select="$twind/*[local-name()='meanWindSpeed'] | $twind/*[local-name()='meanWindSpeed'] | $twind/*[local-name()='meanWindSpeed']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$twind/*[local-name()='meanWindSpeed']/@uom | $twind/*[local-name()='meanWindSpeed']/@uom | $twind/*[local-name()='meanWindSpeed']/@uom"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$trend/*[local-name()='prevailingVisibility'] | $trend/*[local-name()='prevailingVisibility'] | $trend/*[local-name()='prevailingVisibility']">
                <h3>Prevailing Visibility</h3>
                <div class="field">
                    <span class="value">
                        <xsl:if test="$trend/*[local-name()='prevailingVisibilityOperator'] | $trend/*[local-name()='prevailingVisibilityOperator'] | $trend/*[local-name()='prevailingVisibilityOperator']">
                            <xsl:value-of select="$trend/*[local-name()='prevailingVisibilityOperator'] | $trend/*[local-name()='prevailingVisibilityOperator'] | $trend/*[local-name()='prevailingVisibilityOperator']"/>
                            <xsl:text> </xsl:text>
                        </xsl:if>
                        <xsl:value-of select="$trend/*[local-name()='prevailingVisibility'] | $trend/*[local-name()='prevailingVisibility'] | $trend/*[local-name()='prevailingVisibility']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$trend/*[local-name()='prevailingVisibility']/@uom | $trend/*[local-name()='prevailingVisibility']/@uom | $trend/*[local-name()='prevailingVisibility']/@uom"/>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:if test="$trend/*[local-name()='weather'] | $trend/*[local-name()='weather'] | $trend/*[local-name()='weather']">
                <h3>Weather</h3>
                <xsl:for-each select="$trend/*[local-name()='weather'] | $trend/*[local-name()='weather'] | $trend/*[local-name()='weather']">
                    <div class="field">
                        <span class="value">
                            <xsl:call-template name="format-weather-code">
                                <xsl:with-param name="code" select="@*[local-name()='href']"/>
                            </xsl:call-template>
                        </span>
                    </div>
                </xsl:for-each>
            </xsl:if>
            
            <xsl:if test="$trend/*[local-name()='cloud'] | $trend/*[local-name()='cloud'] | $trend/*[local-name()='cloud']">
                <h3>Cloud</h3>
                <xsl:apply-templates select="$trend/*[local-name()='cloud'] | $trend/*[local-name()='cloud'] | $trend/*[local-name()='cloud']" mode="forecast"/>
            </xsl:if>
        </div>
    </xsl:template>
    
    <!-- Cloud Information - Namespace Independent -->
    <xsl:template match="*[local-name()='cloud']">
        <xsl:variable name="cloudData" select=".//*[local-name()='AerodromeCloud']"/>
        
        <xsl:if test="$cloudData/*[local-name()='verticalVisibility']">
            <div class="field">
                <span class="label">Vertical Visibility:</span>
                <span class="value">
                    <xsl:value-of select="$cloudData/*[local-name()='verticalVisibility'] | $cloudData/*[local-name()='verticalVisibility'] | $cloudData/*[local-name()='verticalVisibility']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$cloudData/*[local-name()='verticalVisibility']/@uom | $cloudData/*[local-name()='verticalVisibility']/@uom | $cloudData/*[local-name()='verticalVisibility']/@uom"/>
                </span>
            </div>
        </xsl:if>
        
        <xsl:if test="$cloudData/*[local-name()='layer'] | $cloudData/*[local-name()='layer'] | $cloudData/*[local-name()='layer']">
            <table class="obs-table">
                <thead>
                    <tr>
                        <th>Amount</th>
                        <th>Base Height</th>
                        <th>Cloud Type</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="$cloudData/*[local-name()='layer'] | $cloudData/*[local-name()='layer'] | $cloudData/*[local-name()='layer']">
                        <xsl:variable name="layerData" select=".//*[local-name()='CloudLayer'] | .//*[local-name()='CloudLayer'] | .//*[local-name()='CloudLayer']"/>
                        <tr>
                            <td>
                                <xsl:call-template name="format-weather-code">
                                    <xsl:with-param name="code" select="$layerData/*[local-name()='amount']/@*[local-name()='href'] | $layerData/*[local-name()='amount']/@*[local-name()='href'] | $layerData/*[local-name()='amount']/@*[local-name()='href']"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:value-of select="$layerData/*[local-name()='base'] | $layerData/*[local-name()='base'] | $layerData/*[local-name()='base']"/>
                                <xsl:text> </xsl:text>
                                <xsl:value-of select="$layerData/*[local-name()='base']/@uom | $layerData/*[local-name()='base']/@uom | $layerData/*[local-name()='base']/@uom"/>
                            </td>
                            <td>
                                <xsl:choose>
                                    <xsl:when test="$layerData/*[local-name()='cloudType'] | $layerData/*[local-name()='cloudType'] | $layerData/*[local-name()='cloudType']">
                                        <xsl:call-template name="format-weather-code">
                                            <xsl:with-param name="code" select="$layerData/*[local-name()='cloudType']/@*[local-name()='href'] | $layerData/*[local-name()='cloudType']/@*[local-name()='href'] | $layerData/*[local-name()='cloudType']/@*[local-name()='href']"/>
                                        </xsl:call-template>
                                    </xsl:when>
                                    <xsl:otherwise>-</xsl:otherwise>
                                </xsl:choose>
                            </td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>
    
    <!-- Cloud Forecast Template -->
    <xsl:template match="*[local-name()='cloud']" mode="forecast">
        <xsl:variable name="cloudData" select=".//*[local-name()='AerodromeCloudForecast']"/>
        
        <xsl:if test="$cloudData/*[local-name()='verticalVisibility']">
            <div class="field">
                <span class="label">Vertical Visibility:</span>
                <span class="value">
                    <xsl:value-of select="$cloudData/*[local-name()='verticalVisibility']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$cloudData/*[local-name()='verticalVisibility']/@uom"/>
                </span>
            </div>
        </xsl:if>
        
        <xsl:if test="$cloudData/*[local-name()='layer']">
            <xsl:for-each select="$cloudData/*[local-name()='layer']">
                <xsl:variable name="layerData" select=".//*[local-name()='CloudLayer']"/>
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="$layerData/*[local-name()='amount']/@*[local-name()='href'] | $layerData/*[local-name()='amount']/@*[local-name()='href']"/>
                        </xsl:call-template>
                        <xsl:text> at </xsl:text>
                        <xsl:value-of select="$layerData/*[local-name()='base']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$layerData/*[local-name()='base']/@uom"/>
                        <xsl:if test="$layerData/*[local-name()='cloudType']">
                            <xsl:text> (</xsl:text>
                            <xsl:call-template name="format-weather-code">
                                <xsl:with-param name="code" select="$layerData/*[local-name()='cloudType']/@*[local-name()='href'] | $layerData/*[local-name()='cloudType']/@*[local-name()='href']"/>
                            </xsl:call-template>
                            <xsl:text>)</xsl:text>
                        </xsl:if>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
    </xsl:template>
    
    <!-- TAF Template -->
    <xsl:template match="*[local-name()='TAF' and (namespace-uri()='http://icao.int/iwxxm/3.0' or namespace-uri()='http://icao.int/iwxxm/2.1' or namespace-uri()='http://icao.int/iwxxm/2023-1')]" priority="1">
        <div class="header">
            <h1>TAF - Terminal Aerodrome Forecast</h1>
        </div>
        
        <div class="section">
            <h2>Forecast Information</h2>
            <div class="field">
                <span class="label">Status:</span>
                <span class="value"><xsl:value-of select="@reportStatus | @status"/></span>
            </div>
            <xsl:if test="@permissibleUsage">
                <div class="field">
                    <span class="label">Permissible Usage:</span>
                    <span class="value"><xsl:value-of select="@permissibleUsage"/></span>
                </div>
            </xsl:if>
            <xsl:if test="@permissibleUsageSupplementary and @permissibleUsageSupplementary != ''">
                <div class="field">
                    <span class="label">Usage Supplementary:</span>
                    <span class="value"><xsl:value-of select="@permissibleUsageSupplementary"/></span>
                </div>
            </xsl:if>
            <xsl:if test="@isCancelReport = 'true'">
                <div class="warning">
                    <strong>CANCELLATION REPORT</strong>
                </div>
            </xsl:if>
            <div class="field">
                <span class="label">Issue Time:</span>
                <span class="value"><xsl:value-of select="*[local-name()='issueTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/></span>
            </div>
            <div class="field">
                <span class="label">Aerodrome:</span>
                <span class="value">
                    <xsl:value-of select=".//*[local-name()='designator']"/>
                    <xsl:if test=".//*[local-name()='name' and namespace-uri()='http://www.aixm.aero/schema/5.1.1']"> - <xsl:value-of select=".//*[local-name()='name' and namespace-uri()='http://www.aixm.aero/schema/5.1.1']"/></xsl:if>
                </span>
            </div>
            <xsl:if test=".//*[local-name()='designatorIATA']">
                <div class="field">
                    <span class="label">IATA Code:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='designatorIATA']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='pos']">
                <xsl:variable name="coords" select=".//*[local-name()='pos']"/>
                <xsl:variable name="lat" select="substring-before($coords, ' ')"/>
                <xsl:variable name="lon" select="substring-after($coords, ' ')"/>
                <div class="field">
                    <span class="label">Coordinates:</span>
                    <span class="value">
                        <xsl:value-of select="format-number($lat, '0.00')"/>°
                        <xsl:choose>
                            <xsl:when test="$lat >= 0">N</xsl:when>
                            <xsl:otherwise>S</xsl:otherwise>
                        </xsl:choose>
                        , 
                        <xsl:value-of select="format-number($lon, '0.00')"/>°
                        <xsl:choose>
                            <xsl:when test="$lon >= 0">E</xsl:when>
                            <xsl:otherwise>W</xsl:otherwise>
                        </xsl:choose>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='fieldElevation']">
                <div class="field">
                    <span class="label">Elevation:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='fieldElevation']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select=".//*[local-name()='fieldElevation']/@*[local-name()='uom']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='type']">
                <div class="field">
                    <span class="label">Aerodrome Type:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='type']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='privateUse']">
                <div class="field">
                    <span class="label">Private Use:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='privateUse']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='controlType']">
                <div class="field">
                    <span class="label">Control Type:</span>
                    <span class="value">
                        <xsl:value-of select=".//*[local-name()='controlType']"/>
                    </span>
                </div>
            </xsl:if>
            <xsl:if test="*[local-name()='validPeriod']">
                <div class="field">
                    <span class="label">Valid Period:</span>
                    <span class="value">
                        <xsl:value-of select="*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='beginPosition']"/> to 
                        <xsl:value-of select="*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='endPosition']"/>
                    </span>
                </div>
            </xsl:if>
        </div>
        
        <xsl:apply-templates select="*[local-name()='baseForecast']" mode="taf-base"/>
        <xsl:apply-templates select="*[local-name()='changeForecast']" mode="taf-change"/>
    </xsl:template>
    
    <!-- TAF Base Forecast -->
    <xsl:template match="*[local-name()='baseForecast']" mode="taf-base">
        <div class="forecast-period">
            <h2>Base Forecast</h2>
            <xsl:apply-templates select="*[local-name()='MeteorologicalAerodromeForecast']" mode="forecast"/>
        </div>
    </xsl:template>
    
    <!-- TAF Change Forecast -->
    <xsl:template match="*[local-name()='changeForecast']" mode="taf-change">
        <xsl:variable name="fcst" select="*[local-name()='MeteorologicalAerodromeForecast']"/>
        <div class="change-group">
            <h2>
                Change Forecast 
                <xsl:if test="$fcst/@changeIndicator">
                    (<xsl:value-of select="$fcst/@changeIndicator"/>)
                </xsl:if>
            </h2>
            <div class="field">
                <span class="label">Valid Period:</span>
                <span class="value">
                    <xsl:value-of select=".//*[local-name()='TimePeriod']/*[local-name()='beginPosition']"/> to 
                    <xsl:value-of select=".//*[local-name()='TimePeriod']/*[local-name()='endPosition']"/>
                </span>
            </div>
            <xsl:apply-templates select="$fcst" mode="forecast"/>
        </div>
    </xsl:template>
    
    <!-- Forecast Details -->
    <xsl:template match="*[local-name()='MeteorologicalAerodromeForecast']" mode="forecast">
        <xsl:if test="@cloudAndVisibilityOK = 'true'">
            <div class="field">
                <span class="label">CAVOK:</span>
                <span class="value">Yes</span>
            </div>
        </xsl:if>
        
        <xsl:if test="*[local-name()='surfaceWind']">
            <h3>Surface Wind</h3>
            <xsl:variable name="fwind" select="*[local-name()='surfaceWind']/*[local-name()='AerodromeSurfaceWindForecast']"/>
            
            <xsl:if test="$fwind/@variableWindDirection = 'true'">
                <div class="field">
                    <span class="label">Variable Direction:</span>
                    <span class="value">Yes</span>
                </div>
            </xsl:if>
            
            <xsl:if test="$fwind/*[local-name()='meanWindDirection']">
                <div class="field">
                    <span class="label">Direction:</span>
                    <span class="value">
                        <xsl:value-of select="$fwind/*[local-name()='meanWindDirection']"/>°
                    </span>
                </div>
            </xsl:if>
            
            <div class="field">
                <span class="label">Speed:</span>
                <span class="value">
                    <xsl:value-of select="$fwind/*[local-name()='meanWindSpeed']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="$fwind/*[local-name()='meanWindSpeed']/@uom"/>
                </span>
            </div>
            
            <xsl:if test="$fwind/*[local-name()='windGustSpeed']">
                <div class="field">
                    <span class="label">Gust Speed:</span>
                    <span class="value">
                        <xsl:value-of select="$fwind/*[local-name()='windGustSpeed']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$fwind/*[local-name()='windGustSpeed']/@uom"/>
                    </span>
                </div>
            </xsl:if>
        </xsl:if>
        
        <xsl:if test="*[local-name()='prevailingVisibility']">
            <h3>Visibility</h3>
            <div class="field">
                <span class="label">Prevailing Visibility:</span>
                <span class="value">
                    <xsl:if test="*[local-name()='prevailingVisibilityOperator']">
                        <xsl:value-of select="*[local-name()='prevailingVisibilityOperator']"/>
                        <xsl:text> </xsl:text>
                    </xsl:if>
                    <xsl:value-of select="*[local-name()='prevailingVisibility']"/>
                    <xsl:text> </xsl:text>
                    <xsl:value-of select="*[local-name()='prevailingVisibility']/@uom"/>
                </span>
            </div>
        </xsl:if>
        
        <xsl:if test="*[local-name()='weather']">
            <h3>Forecast Weather</h3>
            <xsl:for-each select="*[local-name()='weather']">
                <div class="field">
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select="@*[local-name()='href'] | @*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
        
        <xsl:if test="*[local-name()='cloud']">
            <h3>Cloud Forecast</h3>
            <xsl:apply-templates select="*[local-name()='cloud']" mode="forecast"/>
        </xsl:if>
        
        <xsl:if test="*[local-name()='temperature']">
            <h3>Temperature Forecast</h3>
            <xsl:for-each select="*[local-name()='temperature']">
                <xsl:variable name="temp" select=".//*[local-name()='AerodromeAirTemperatureForecast']"/>
                <div class="field">
                    <span class="label">Maximum Temperature:</span>
                    <span class="value">
                        <xsl:value-of select="$temp/*[local-name()='maximumAirTemperature']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$temp/*[local-name()='maximumAirTemperature']/@uom"/>
                        <xsl:text> at </xsl:text>
                        <xsl:value-of select="$temp/*[local-name()='maximumAirTemperatureTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/>
                    </span>
                </div>
                <div class="field">
                    <span class="label">Minimum Temperature:</span>
                    <span class="value">
                        <xsl:value-of select="$temp/*[local-name()='minimumAirTemperature']"/>
                        <xsl:text> </xsl:text>
                        <xsl:value-of select="$temp/*[local-name()='minimumAirTemperature']/@uom"/>
                        <xsl:text> at </xsl:text>
                        <xsl:value-of select="$temp/*[local-name()='minimumAirTemperatureTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/>
                    </span>
                </div>
            </xsl:for-each>
        </xsl:if>
    </xsl:template>
    
    <!-- SIGMET Template - Namespace Independent -->
    <xsl:template match="*[(local-name()='SIGMET' or local-name()='TropicalCycloneSIGMET' or local-name()='VolcanicAshSIGMET') and (namespace-uri()='http://icao.int/iwxxm/3.0' or namespace-uri()='http://icao.int/iwxxm/2.1' or namespace-uri()='http://icao.int/iwxxm/2023-1')]" priority="1">
        <div class="header">
            <h1>
                <xsl:choose>
                    <xsl:when test="contains(local-name(), 'TropicalCyclone')">Tropical Cyclone SIGMET</xsl:when>
                    <xsl:when test="contains(local-name(), 'VolcanicAsh')">Volcanic Ash SIGMET</xsl:when>
                    <xsl:otherwise>SIGMET - Significant Meteorological Information</xsl:otherwise>
                </xsl:choose>
            </h1>
        </div>
        
        <div class="sigmet">
            <h2>SIGMET Information</h2>
            <div class="field">
                <span class="label">Status:</span>
                <span class="value"><xsl:value-of select="@status"/></span>
            </div>
            <xsl:if test="@isCancelReport = 'true'">
                <div class="warning">
                    <strong>CANCELLATION REPORT</strong>
                </div>
            </xsl:if>
            <div class="field">
                <span class="label">Issue Time:</span>
                <span class="value"><xsl:value-of select=".//*[local-name()='issueTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition'] | .//*[local-name()='issueTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition'] | .//*[local-name()='issueTime']/*[local-name()='TimeInstant']/*[local-name()='timePosition']"/></span>
            </div>
            <div class="field">
                <span class="label">Issuing ATS Unit:</span>
                <span class="value"><xsl:value-of select=".//*[local-name()='issuingAirTrafficServicesUnit']//*[local-name()='designator'] | .//*[local-name()='issuingAirTrafficServicesUnit']//*[local-name()='designator'] | .//*[local-name()='issuingAirTrafficServicesUnit']//*[local-name()='designator']"/></span>
            </div>
            <xsl:if test=".//*[local-name()='originatingMeteorologicalWatchOffice'] | .//*[local-name()='originatingMeteorologicalWatchOffice'] | .//*[local-name()='originatingMeteorologicalWatchOffice']">
                <div class="field">
                    <span class="label">Originating MWO:</span>
                    <span class="value"><xsl:value-of select=".//*[local-name()='originatingMeteorologicalWatchOffice']//*[local-name()='designator'] | .//*[local-name()='originatingMeteorologicalWatchOffice']//*[local-name()='designator'] | .//*[local-name()='originatingMeteorologicalWatchOffice']//*[local-name()='designator']"/></span>
                </div>
            </xsl:if>
            <xsl:if test=".//*[local-name()='issuingAirTrafficServicesRegion'] | .//*[local-name()='issuingAirTrafficServicesRegion'] | .//*[local-name()='issuingAirTrafficServicesRegion']">
                <div class="field">
                    <span class="label">FIR/UIR/CTA:</span>
                    <span class="value"><xsl:value-of select=".//*[local-name()='issuingAirTrafficServicesRegion']//*[local-name()='designator'] | .//*[local-name()='issuingAirTrafficServicesRegion']//*[local-name()='designator'] | .//*[local-name()='issuingAirTrafficServicesRegion']//*[local-name()='designator']"/></span>
                </div>
            </xsl:if>
            <div class="field">
                <span class="label">Sequence Number:</span>
                <span class="value"><xsl:value-of select=".//*[local-name()='sequenceNumber'] | .//*[local-name()='sequenceNumber'] | .//*[local-name()='sequenceNumber']"/></span>
            </div>
            <div class="field">
                <span class="label">Valid Period:</span>
                <span class="value">
                    <xsl:value-of select=".//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | .//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | .//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='beginPosition']"/> to 
                    <xsl:value-of select=".//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='endPosition'] | .//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='endPosition'] | .//*[local-name()='validPeriod']/*[local-name()='TimePeriod']/*[local-name()='endPosition']"/>
                </span>
            </div>
            <xsl:if test=".//*[local-name()='phenomenon'] | .//*[local-name()='phenomenon'] | .//*[local-name()='phenomenon']">
                <div class="field">
                    <span class="label">Phenomenon:</span>
                    <span class="value">
                        <xsl:call-template name="format-weather-code">
                            <xsl:with-param name="code" select=".//*[local-name()='phenomenon']/@*[local-name()='href'] | .//*[local-name()='phenomenon']/@*[local-name()='href'] | .//*[local-name()='phenomenon']/@*[local-name()='href']"/>
                        </xsl:call-template>
                    </span>
                </div>
            </xsl:if>
            
            <!-- Tropical Cyclone specific -->
            <xsl:if test=".//*[local-name()='tropicalCyclone'] | .//*[local-name()='tropicalCyclone'] | .//*[local-name()='tropicalCyclone'] | .//*[local-name()='TropicalCyclone']">
                <div class="field">
                    <span class="label">Tropical Cyclone Name:</span>
                    <span class="value"><xsl:value-of select=".//*[local-name()='TropicalCyclone']/*[local-name()='name'] | .//*[local-name()='tropicalCyclone']//*[local-name()='name'] | .//*[local-name()='tropicalCyclone']//*[local-name()='name'] | .//*[local-name()='tropicalCyclone']//*[local-name()='name']"/></span>
                </div>
            </xsl:if>
            
            <!-- Volcanic Ash specific -->
            <xsl:if test=".//*[local-name()='eruptingVolcano'] | .//*[local-name()='eruptingVolcano'] | .//*[local-name()='eruptingVolcano'] | .//*[local-name()='Volcano']">
                <div class="field">
                    <span class="label">Erupting Volcano:</span>
                    <span class="value"><xsl:value-of select=".//*[local-name()='Volcano']/*[local-name()='name'] | .//*[local-name()='eruptingVolcano']//*[local-name()='name'] | .//*[local-name()='eruptingVolcano']//*[local-name()='name'] | .//*[local-name()='eruptingVolcano']//*[local-name()='name']"/></span>
                </div>
                <xsl:if test=".//*[local-name()='Volcano']/*[local-name()='position'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position']">
                    <div class="field">
                        <span class="label">Volcano Position:</span>
                        <span class="value"><xsl:value-of select=".//*[local-name()='Volcano']/*[local-name()='position']/*[local-name()='Point']/*[local-name()='pos'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position']/*[local-name()='Point']/*[local-name()='pos'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position']/*[local-name()='Point']/*[local-name()='pos'] | .//*[local-name()='eruptingVolcano']//*[local-name()='position']/*[local-name()='Point']/*[local-name()='pos']"/></span>
                    </div>
                </xsl:if>
            </xsl:if>
        </div>
        
        <xsl:apply-templates select=".//*[local-name()='analysis'] | .//*[local-name()='analysis'] | .//*[local-name()='analysis'] | .//*[local-name()='analysisCollection'] | .//*[local-name()='analysisCollection'] | .//*[local-name()='analysisCollection']"/>
    </xsl:template>
    
    <!-- SIGMET Analysis - Namespace Independent -->
    <xsl:template match="*[(local-name()='analysis' or local-name()='analysisCollection') and (namespace-uri()='http://icao.int/iwxxm/3.0' or namespace-uri()='http://icao.int/iwxxm/2.1' or namespace-uri()='http://icao.int/iwxxm/2023-1')]">
        <div class="section">
            <h2>Analysis</h2>
            <xsl:variable name="analysis" select=".//*[local-name()='analysis'] | .//*[local-name()='SIGMETEvolvingConditionCollection']"/>
            
            <xsl:if test="$analysis/@timeIndicator">
                <div class="field">
                    <span class="label">Time Indicator:</span>
                    <span class="value"><xsl:value-of select="$analysis/@timeIndicator"/></span>
                </div>
            </xsl:if>
            
            <xsl:if test="$analysis/*[local-name()='phenomenonTime'] | $analysis/*[local-name()='phenomenonTime'] | $analysis/*[local-name()='phenomenonTime']">
                <div class="field">
                    <span class="label">Phenomenon Time:</span>
                    <span class="value">
                        <xsl:choose>
                            <xsl:when test="$analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']">
                                <xsl:value-of select="$analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='beginPosition']"/> to 
                                <xsl:value-of select="$analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimePeriod']/*[local-name()='endPosition']"/>
                            </xsl:when>
                            <xsl:otherwise>
                                <xsl:value-of select="$analysis/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $analysis/*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition']"/>
                            </xsl:otherwise>
                        </xsl:choose>
                    </span>
                </div>
            </xsl:if>
            
            <xsl:for-each select="$analysis/*[local-name()='member'] | $analysis/*[local-name()='member'] | $analysis/*[local-name()='member'] | .//*[local-name()='SIGMETEvolvingCondition'] | .//*[local-name()='SIGMETEvolvingCondition'] | .//*[local-name()='SIGMETEvolvingCondition']">
                <xsl:variable name="cond" select=".//*[local-name()='SIGMETEvolvingCondition'] | .//*[local-name()='SIGMETEvolvingCondition'] | .//*[local-name()='SIGMETEvolvingCondition'] | ."/>
                
                <h3>Evolving Condition <xsl:value-of select="position()"/></h3>
                
                <xsl:if test="$cond/@intensityChange">
                    <div class="field">
                        <span class="label">Intensity Change:</span>
                        <span class="value"><xsl:value-of select="$cond/@intensityChange"/></span>
                    </div>
                </xsl:if>
                
                <xsl:if test="$cond/@approximateLocation = 'true'">
                    <div class="field">
                        <span class="label">Approximate Location:</span>
                        <span class="value">Yes</span>
                    </div>
                </xsl:if>
                
                <xsl:if test="$cond/*[local-name()='directionOfMotion'] | $cond/*[local-name()='directionOfMotion'] | $cond/*[local-name()='directionOfMotion']">
                    <div class="field">
                        <span class="label">Direction of Motion:</span>
                        <span class="value"><xsl:value-of select="$cond/*[local-name()='directionOfMotion'] | $cond/*[local-name()='directionOfMotion'] | $cond/*[local-name()='directionOfMotion']"/>°</span>
                    </div>
                </xsl:if>
                
                <xsl:if test="$cond/*[local-name()='speedOfMotion'] | $cond/*[local-name()='speedOfMotion'] | $cond/*[local-name()='speedOfMotion']">
                    <div class="field">
                        <span class="label">Speed of Motion:</span>
                        <span class="value">
                            <xsl:value-of select="$cond/*[local-name()='speedOfMotion'] | $cond/*[local-name()='speedOfMotion'] | $cond/*[local-name()='speedOfMotion']"/>
                            <xsl:text> </xsl:text>
                            <xsl:value-of select="$cond/*[local-name()='speedOfMotion']/@uom | $cond/*[local-name()='speedOfMotion']/@uom | $cond/*[local-name()='speedOfMotion']/@uom"/>
                        </span>
                    </div>
                </xsl:if>
                
                <xsl:if test="$cond/*[local-name()='tropicalCyclonePosition'] | $cond/*[local-name()='tropicalCyclonePosition'] | $cond/*[local-name()='tropicalCyclonePosition']">
                    <div class="field">
                        <span class="label">Tropical Cyclone Position:</span>
                        <span class="value"><xsl:value-of select="$cond/*[local-name()='tropicalCyclonePosition']/*[local-name()='Point']/*[local-name()='pos'] | $cond/*[local-name()='tropicalCyclonePosition']/*[local-name()='Point']/*[local-name()='pos'] | $cond/*[local-name()='tropicalCyclonePosition']/*[local-name()='Point']/*[local-name()='pos']"/></span>
                    </div>
                </xsl:if>
                
                <xsl:if test="$cond/*[local-name()='geometry'] | $cond/*[local-name()='geometry'] | $cond/*[local-name()='geometry']">
                    <div class="field">
                        <span class="label">Affected Area:</span>
                        <span class="value">Geometry defined</span>
                    </div>
                </xsl:if>
            </xsl:for-each>
            
            <!-- Forecast Position -->
            <xsl:if test=".//*[local-name()='forecastPositionAnalysis'] | .//*[local-name()='forecastPositionAnalysis'] | .//*[local-name()='forecastPositionAnalysis']">
                <h3>Forecast Position</h3>
                <xsl:variable name="fcstPos" select=".//*[local-name()='forecastPositionAnalysis'] | .//*[local-name()='forecastPositionAnalysis'] | .//*[local-name()='forecastPositionAnalysis']"/>
                <div class="field">
                    <span class="label">Forecast Time:</span>
                    <span class="value">
                        <xsl:value-of select="$fcstPos//*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $fcstPos//*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition'] | $fcstPos//*[local-name()='phenomenonTime']//*[local-name()='TimeInstant']/*[local-name()='timePosition']"/>
                    </span>
                </div>
            </xsl:if>
        </div>
    </xsl:template>
    
    <!-- Helper template to format weather codes -->
    <xsl:template name="format-weather-code">
        <xsl:param name="code"/>
        <xsl:choose>
            <xsl:when test="contains($code, '/')">
                <!-- Extract the last part after the last / -->
                <xsl:call-template name="extract-code-value">
                    <xsl:with-param name="url" select="$code"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$code"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
    <!-- Helper template to extract code from URL -->
    <xsl:template name="extract-code-value">
        <xsl:param name="url"/>
        <xsl:choose>
            <xsl:when test="contains($url, '/')">
                <xsl:call-template name="extract-code-value">
                    <xsl:with-param name="url" select="substring-after($url, '/')"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$url"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
</xsl:stylesheet>
