// ========== Graph Functionality ==========
let cy;


async function loadGraph() {
  console.log('📊 GRAPH: Loading graph data...');
  try {
    // Check if Cytoscape is loaded
    if (typeof cytoscape === 'undefined') {
      console.error('❌ GRAPH: Cytoscape.js not loaded');
      document.getElementById('cy').innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Cytoscape.js library not loaded. Please refresh the page.</div>';
      return;
    }

    console.log('✅ GRAPH: Cytoscape.js is loaded');

    // Check if container exists
    const container = document.getElementById('cy');
    if (!container) {
      console.error('❌ GRAPH: Container element #cy not found');
      return;
    }

    console.log('✅ GRAPH: Container element found');

    const res = await fetch(API_BASE_URL + '/api/graph');
    if (!res.ok) {
      console.error('❌ GRAPH: API request failed', res.status);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load graph data. Please try again.</div>';
      return;
    }

    const elements = await res.json();
    console.log('📊 GRAPH: Received', elements.length, 'elements from API');

    if (!elements || elements.length === 0) {
      console.log('📊 GRAPH: No elements to display');
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">No graph data available. Create some projects and tasks first.</div>';
      return;
    }

    if (!cy) {
      console.log('📊 GRAPH: Creating new Cytoscape instance');

      // Create new cytoscape instance
      cy = cytoscape({
        container: container,
        elements: elements,
        
        // Renderer settings for better quality
        renderer: {
          name: 'canvas',
          hideEdgesOnViewport: false,
          hideLabelsOnViewport: false,
          textureOnViewport: false,
          motionBlur: false,
          motionBlurOpacity: 0.2,
          wheelSensitivity: 0.1
        },
        
        style: [
          {
            selector: 'node[type="project"]',
            style: {
              'label': 'data(label)',
              'shape': 'ellipse',
              'background-color': '#3498db',
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 120,
              'height': 60,
              'font-size': 12,
              'border-width': 2,
              'border-color': '#2980b9',
              'z-index': 10
            }
          },
          {
            selector: 'node[type="task"]',
            style: {
              'label': 'data(label)',
              'shape': 'round-rectangle',
              'background-color': function(ele) {
                // Use status-based colors since color field may not be available
                const status = ele.data('status');
                switch(status) {
                  case 'completed': return '#10b981';
                  case 'in_progress': return '#f59e0b';
                  case 'todo': return '#3b82f6';
                  case 'overdue': return '#ef4444';
                  default: return '#6b7280';
                }
              },
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 140,
              'height': 50,
              'font-size': 11,
              'border-width': 2,
              'border-color': '#2c3e50',
              'z-index': 10
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 4,
              'line-color': '#3498db',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#3498db',
              'source-arrow-shape': 'none',
              'curve-style': 'bezier',
              'arrow-scale': 1.8,
              'opacity': 0.95,
              'z-index': 999,
              'overlay-opacity': 0,
              'line-cap': 'round'
            }
          },
          {
            selector: 'edge[type="belongs_to"]',
            style: {
              'line-color': '#28a745',
              'target-arrow-color': '#28a745',
              'width': 4,
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge[type="subtask"]',
            style: {
              'line-style': 'dashed',
              'line-dash-pattern': [10, 5],
              'line-color': '#6f42c1',
              'target-arrow-color': '#6f42c1',
              'width': 3,
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge[type="depends_on"]',
            style: {
              'line-color': '#dc3545',
              'target-arrow-color': '#dc3545',
              'width': 4,
              'target-arrow-shape': 'triangle',
              'source-arrow-shape': 'circle',
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge:selected',
            style: {
              'line-color': '#f39c12',
              'target-arrow-color': '#f39c12',
              'width': 5,
              'opacity': 1,
              'z-index': 1000
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'border-color': '#f39c12',
              'overlay-opacity': 0.2,
              'overlay-color': '#f39c12'
            }
          },
          {
            selector: 'node:active',
            style: {
              'overlay-opacity': 0.3,
              'overlay-color': '#3498db'
            }
          }
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 80,
          spacingFactor: 1.5,
          avoidOverlap: true,
          maximal: true,
          grid: false,
          circle: false,
          tree: false
        }
      });

      console.log('✅ GRAPH: Cytoscape instance created successfully');
      console.log('📊 GRAPH: Nodes in instance:', cy.nodes().length);
      console.log('📊 GRAPH: Edges in instance:', cy.edges().length);
      
      // Log node types for debugging
      const projectNodes = cy.nodes('[type="project"]').length;
      const taskNodes = cy.nodes('[type="task"]').length;
      console.log(`📁 Project nodes: ${projectNodes}`);
      console.log(`✓ Task nodes: ${taskNodes}`);
      
      // Sample node IDs for debugging
      if (cy.nodes().length > 0) {
        const sampleNode = cy.nodes()[0];
        console.log(`🔍 Sample node ID: "${sampleNode.data('id')}", Type: "${sampleNode.data('type')}", Label: "${sampleNode.data('label')}"`);
      }
      
      // Multiple passes to force edge visibility
      const forceEdgeVisibility = () => {
        if (cy && cy.edges()) {
          cy.edges().forEach(edge => {
            edge.style({
              'opacity': 0.95,
              'z-index': 999,
              'display': 'element'
            });
          });
        }
      };
      
      // Force edges at multiple intervals
      setTimeout(() => {
        forceEdgeVisibility();
        cy.fit(50);
        console.log('🔄 GRAPH: Pass 1 - Edge visibility enforced');
      }, 100);
      
      setTimeout(() => {
        forceEdgeVisibility();
        cy.forceRender();
        console.log('🔄 GRAPH: Pass 2 - Forced render');
      }, 300);
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 GRAPH: Pass 3 - Final edge check');
      }, 600);
      
      // Keep edges visible on any graph event
      cy.on('render', function() {
        cy.edges().forEach(edge => {
          if (edge.style('opacity') < 0.9) {
            edge.style('opacity', 0.95);
          }
        });
      });
      
      // ========== INTERACTIVE GRAPH FEATURES ==========
      
      console.log('🎮 Setting up interactive graph features...');
      
      // Enhanced hover effects with animation
      cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        const nodeId = node.data('id');
        
        node.animate({
          style: {
            'border-width': 5,
            'border-color': '#f39c12',
            'box-shadow': '0 0 20px rgba(243, 156, 18, 0.6)',
            'z-index': 999
          },
          duration: 200
        });
        
        // Show visual tooltip
        const label = node.data('label');
        const type = nodeType === 'project' ? '📁 Project' : '✓ Task';
        console.log(`🎯 Hover: ${type} "${label}" (ID: ${nodeId}) - Click to edit!`);
        
        // Change cursor
        const cyContainer = document.getElementById('cy');
        if (cyContainer) cyContainer.style.cursor = 'pointer';
      });
      
      cy.on('mouseout', 'node', function(evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        
        node.animate({
          style: {
            'border-width': 2,
            'border-color': nodeType === 'project' ? '#2980b9' : '#2c3e50',
            'box-shadow': 'none',
            'z-index': 10
          },
          duration: 200
        });
        
        // Reset cursor
        document.getElementById('cy').style.cursor = 'grab';
      });
      
      // Click to edit - Projects
      cy.on('tap', 'node[type="project"]', function(evt) {
        evt.preventDefault();
        const node = evt.target;
        const nodeId = node.data('id');
        const projectName = node.data('label');
        
        // Extract numeric ID from formats like "project-1" or "project_1"
        const projectId = nodeId.replace(/project[-_]/, '');
        
        console.log(`📁 CLICK DETECTED: Project "${projectName}" (Node ID: ${nodeId}, Extracted ID: ${projectId})`);
        
        // Visual feedback - pulse animation
        node.animate({
          style: {
            'border-color': '#3498db',
            'border-width': 8
          },
          duration: 200,
          complete: function() {
            node.style({
              'border-width': 2,
              'border-color': '#2980b9'
            });
          }
        });
        
        // Fetch and edit
        console.log(`🔍 Fetching project data from /api/projects/${projectId}...`);
        fetch(`${API_BASE_URL}/api/projects/${projectId}`)
          .then(res => {
            console.log(`📡 Response status: ${res.status}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project`);
            return res.json();
          })
          .then(project => {
            console.log('✅ Project data loaded:', project);
            console.log('🔄 Switching to projects view...');
            showView('projects');
            setTimeout(() => {
              console.log('✏️ Calling editProject function...');
              if (typeof editProject === 'function') {
                editProject(
                  project.id,
                  project.name || '',
                  project.start_date || '',
                  project.end_date || '',
                  project.description || ''
                );
                console.log('✅ Edit form populated successfully');
              } else {
                console.error('❌ editProject function not found!');
                alert('Edit function not available. Please refresh the page.');
              }
            }, 300);
          })
          .catch(err => {
            console.error('❌ Error fetching project:', err);
            alert(`⚠️ Failed to load project details: ${err.message}`);
          });
      });
      
      // Click to edit - Tasks
      cy.on('tap', 'node[type="task"]', function(evt) {
        evt.preventDefault();
        const node = evt.target;
        const nodeId = node.data('id');
        const taskLabel = node.data('label');
        
        // Extract numeric ID from formats like "task-5" or "task_5"
        const taskId = nodeId.replace(/task[-_]/, '');
        
        console.log(`✓ CLICK DETECTED: Task "${taskLabel}" (Node ID: ${nodeId}, Extracted ID: ${taskId})`);
        
        // Visual feedback - pulse animation
        node.animate({
          style: {
            'border-color': '#3498db',
            'border-width': 8
          },
          duration: 200,
          complete: function() {
            node.style({
              'border-width': 2,
              'border-color': '#2c3e50'
            });
          }
        });
        
        // Navigate and edit
        console.log('🔄 Switching to tasks view...');
        showView('tasks');
        setTimeout(() => {
          console.log(`✏️ Calling editTask(${taskId})...`);
          if (typeof editTask === 'function') {
            editTask(parseInt(taskId));
            console.log('✅ Edit form should be loading...');
          } else {
            console.error('❌ editTask function not found!');
            alert('Edit function not available. Please refresh the page.');
          }
        }, 300);
      });
      
      // Double-click for quick edit (alternative interaction)
      cy.on('dbltap', 'node', function(evt) {
        const node = evt.target;
        console.log(`⚡ Double-click detected on: ${node.data('label')}`);
        // Trigger single click handler
        evt.target.trigger('tap');
      });
      
      // Visual feedback on edges hover
      cy.on('mouseover', 'edge', function(evt) {
        const edge = evt.target;
        edge.animate({
          style: {
            'width': 6,
            'line-color': '#f39c12',
            'target-arrow-color': '#f39c12',
            'opacity': 1
          },
          duration: 200
        });
      });
      
      cy.on('mouseout', 'edge', function(evt) {
        const edge = evt.target;
        const type = edge.data('type');
        let color = '#3498db';
        
        if (type === 'belongs_to') color = '#28a745';
        if (type === 'subtask') color = '#6f42c1';
        if (type === 'depends_on') color = '#dc3545';
        
        edge.animate({
          style: {
            'width': 4,
            'line-color': color,
            'target-arrow-color': color,
            'opacity': 0.95
          },
          duration: 200
        });
      });
      
      console.log('✅ All interactive event handlers registered successfully!');
      console.log('🎯 Click any node to edit (Projects or Tasks)');
      console.log('💡 TIP: Check console for detailed debugging info when clicking');
      
    } else {
      // Update existing instance
      cy.json({ elements: elements });
      cy.layout({
        name: 'breadthfirst',
        directed: true,
        padding: 80,
        spacingFactor: 1.5,
        avoidOverlap: true,
        maximal: true,
        animate: true,
        animationDuration: 500
      }).run();
      
      // Force edges to stay visible after update - multiple passes
      const forceEdgeVisibility = () => {
        if (cy && cy.edges()) {
          cy.edges().forEach(edge => {
            edge.style({
              'opacity': 0.95,
              'z-index': 999,
              'display': 'element'
            });
          });
        }
      };
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 UPDATE: Pass 1 - Edge visibility enforced');
      }, 200);
      
      setTimeout(() => {
        forceEdgeVisibility();
        cy.forceRender();
        console.log('🔄 UPDATE: Pass 2 - Forced render');
      }, 600);
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 UPDATE: Pass 3 - Final edge check');
      }, 1000);
      
      console.log('✅ GRAPH: Graph updated with new data');
    }

    // Debug: Log edge information
    if (cy && elements) {
      const edges = elements.filter(el => el.data.source && el.data.target);
      console.log(`📊 GRAPH DEBUG: ${edges.length} edges loaded`);
      if (edges.length > 0) {
        edges.forEach((edge, index) => {
          if (index < 3) { // Log first 3 edges
            console.log(`   Edge ${index}: ${edge.data.source} → ${edge.data.target} (${edge.data.type})`);
          }
        });
      }

      // Check if nodes exist for edges
      const nodes = elements.filter(el => !el.data.source);
      const nodeIds = nodes.map(n => n.data.id);
      const validEdges = edges.filter(edge =>
        nodeIds.includes(edge.data.source) && nodeIds.includes(edge.data.target)
      );
      console.log(`📊 GRAPH DEBUG: ${validEdges.length}/${edges.length} edges have valid source/target nodes`);

      if (edges.length !== validEdges.length) {
        console.warn('⚠️ GRAPH WARNING: Some edges reference non-existent nodes');
      }
    }

    // ========== ENHANCED GRAPH CONTROLS ==========
    
    // Update graph statistics
    function updateGraphStats() {
      if (!cy) return;
      
      const projectCount = cy.nodes('[type="project"]').length;
      const taskCount = cy.nodes('[type="task"]').length;
      const edgeCount = cy.edges().length;
      const zoomLevel = Math.round(cy.zoom() * 100);
      
      const projectCountEl = document.getElementById('projectCount');
      const taskCountEl = document.getElementById('taskCount');
      const edgeCountEl = document.getElementById('edgeCount');
      const zoomLevelEl = document.getElementById('zoomLevel');
      
      if (projectCountEl) projectCountEl.textContent = projectCount;
      if (taskCountEl) taskCountEl.textContent = taskCount;
      if (edgeCountEl) edgeCountEl.textContent = edgeCount;
      if (zoomLevelEl) zoomLevelEl.textContent = zoomLevel + '%';
      
      console.log(`📊 Stats: ${projectCount} projects, ${taskCount} tasks, ${edgeCount} edges, ${zoomLevel}% zoom`);
    }
    
    // Update stats on zoom and pan
    cy.on('zoom', updateGraphStats);
    cy.on('pan', updateGraphStats);
    
    // Initial stats update
    setTimeout(updateGraphStats, 500);
    
    // Set up layout selector with enhanced options
    const layoutSelect = document.getElementById('layoutSelect');
    if (layoutSelect) {
      layoutSelect.onchange = (e) => {
        const layoutName = e.target.value;
        let layoutConfig;

        switch (layoutName) {
          case 'breadthfirst':
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 80,
              spacingFactor: 1.5,
              avoidOverlap: true,
              maximal: true,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'cose':
            layoutConfig = {
              name: 'cose',
              animate: true,
              padding: 80,
              nodeOverlap: 20,
              idealEdgeLength: 100,
              nodeRepulsion: 400000,
              edgeElasticity: 100,
              gravity: 80,
              numIter: 1000,
              animationDuration: 500
            };
            break;
          case 'concentric':
            layoutConfig = {
              name: 'concentric',
              animate: true,
              padding: 80,
              startAngle: 3.14 / 2,
              sweep: undefined,
              clockwise: true,
              equidistant: false,
              minNodeSpacing: 50,
              concentric: function(node) {
                return node.data('type') === 'project' ? 2 : 1;
              },
              levelWidth: function() { return 2; },
              animationDuration: 500
            };
            break;
          case 'grid':
            layoutConfig = {
              name: 'grid',
              padding: 80,
              avoidOverlap: true,
              avoidOverlapPadding: 20,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'circle':
            layoutConfig = {
              name: 'circle',
              padding: 80,
              avoidOverlap: true,
              animate: true,
              animationDuration: 500,
              radius: undefined,
              startAngle: 3.14 / 2,
              sweep: undefined,
              clockwise: true
            };
            break;
          case 'dagre':
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 100,
              spacingFactor: 2,
              avoidOverlap: true,
              nodeDimensionsIncludeLabels: true,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'cola':
            layoutConfig = {
              name: 'cose',
              animate: true,
              padding: 100,
              nodeOverlap: 30,
              idealEdgeLength: 150,
              nodeRepulsion: 500000,
              edgeElasticity: 50,
              gravity: 50,
              animationDuration: 500
            };
            break;
          default:
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 80,
              spacingFactor: 1.5,
              animate: true,
              animationDuration: 500
            };
        }

        cy.layout(layoutConfig).run();
        console.log('🔄 GRAPH: Layout changed to', layoutName);
      };
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const fitGraphBtn = document.getElementById('fitGraph');
    const resetViewBtn = document.getElementById('resetView');
    
    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        cy.zoom(cy.zoom() * 1.2);
        cy.center();
        console.log('🔍 Zoom In');
      };
    }
    
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        cy.zoom(cy.zoom() * 0.8);
        cy.center();
        console.log('🔍 Zoom Out');
      };
    }
    
    if (fitGraphBtn) {
      fitGraphBtn.onclick = () => {
        cy.fit(50);
        console.log('🔍 Fit to Screen');
      };
    }
    
    if (resetViewBtn) {
      resetViewBtn.onclick = () => {
        cy.zoom(1);
        cy.center();
        console.log('🔍 Reset View');
      };
    }

    // Filter controls
    const showProjectsCheckbox = document.getElementById('showProjects');
    const showTasksCheckbox = document.getElementById('showTasks');
    const showEdgesCheckbox = document.getElementById('showEdges');
    
    function applyFilters() {
      if (!cy) return;
      
      const showProjects = showProjectsCheckbox ? showProjectsCheckbox.checked : true;
      const showTasks = showTasksCheckbox ? showTasksCheckbox.checked : true;
      const showEdges = showEdgesCheckbox ? showEdgesCheckbox.checked : true;
      
      // Show/hide projects
      if (showProjects) {
        cy.nodes('[type="project"]').style('display', 'element');
      } else {
        cy.nodes('[type="project"]').style('display', 'none');
      }
      
      // Show/hide tasks
      if (showTasks) {
        cy.nodes('[type="task"]').style('display', 'element');
      } else {
        cy.nodes('[type="task"]').style('display', 'none');
      }
      
      // Show/hide edges
      if (showEdges) {
        cy.edges().style('display', 'element');
      } else {
        cy.edges().style('display', 'none');
      }
      
      updateGraphStats();
      console.log('🎨 Filters applied:', { showProjects, showTasks, showEdges });
    }
    
    if (showProjectsCheckbox) showProjectsCheckbox.onchange = applyFilters;
    if (showTasksCheckbox) showTasksCheckbox.onchange = applyFilters;
    if (showEdgesCheckbox) showEdgesCheckbox.onchange = applyFilters;

    // Search and highlight functionality
    const searchInput = document.getElementById('searchGraph');
    const clearSearchBtn = document.getElementById('clearSearch');
    let highlightedNodes = null;
    
    function searchNodes(searchTerm) {
      if (!cy || !searchTerm) {
        clearSearch();
        return;
      }
      
      const term = searchTerm.toLowerCase();
      
      // Reset all nodes to normal
      cy.nodes().style({
        'opacity': 0.3,
        'border-width': 2
      });
      
      cy.edges().style('opacity', 0.2);
      
      // Find matching nodes
      highlightedNodes = cy.nodes().filter(function(node) {
        const label = node.data('label').toLowerCase();
        return label.includes(term);
      });
      
      // Highlight matching nodes
      highlightedNodes.style({
        'opacity': 1,
        'border-width': 4,
        'border-color': '#f39c12'
      });
      
      // Highlight connected edges
      highlightedNodes.connectedEdges().style('opacity', 1);
      
      console.log(`🔍 Search: Found ${highlightedNodes.length} matching nodes for "${searchTerm}"`);
      
      // Fit view to highlighted nodes if any found
      if (highlightedNodes.length > 0) {
        cy.fit(highlightedNodes, 100);
      }
    }
    
    function clearSearch() {
      if (!cy) return;
      
      cy.nodes().style({
        'opacity': 1,
        'border-width': 2
      });
      
      cy.edges().style('opacity', 0.95);
      
      highlightedNodes = null;
      
      if (searchInput) searchInput.value = '';
      
      console.log('🔍 Search cleared');
    }
    
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchNodes(e.target.value);
      };
      
      searchInput.onkeydown = (e) => {
        if (e.key === 'Escape') {
          clearSearch();
        }
      };
    }
    
    if (clearSearchBtn) {
      clearSearchBtn.onclick = clearSearch;
    }

    // Export graph as PNG
    const exportBtn = document.getElementById('exportGraph');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (!cy) {
          alert('Graph not loaded');
          return;
        }
        
        try {
          // Get PNG data
          const png64 = cy.png({
            output: 'blob',
            bg: '#ffffff',
            full: true,
            scale: 2
          });
          
          // Create download link
          const url = URL.createObjectURL(png64);
          const link = document.createElement('a');
          link.href = url;
          link.download = `graph-${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log('📸 Graph exported as PNG');
          
          // Visual feedback
          exportBtn.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Exported!
          `;
          
          setTimeout(() => {
            exportBtn.innerHTML = `
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export PNG
            `;
          }, 2000);
          
        } catch (error) {
          console.error('❌ Export error:', error);
          alert('Failed to export graph. Please try again.');
        }
      };
    }

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshGraph');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        loadGraph();
        console.log('🔄 GRAPH: Manual refresh triggered');
      };
    }

  } catch (err) {
    console.error('❌ GRAPH ERROR:', err);
    const container = document.getElementById('cy');
    if (container) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading graph: ' + err.message + '</div>';
    }
  }
}