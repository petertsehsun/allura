/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/

$(window).load(function() {
    if(!window.markdown_init){
        window.markdown_init = true;
        $('div.markdown_edit').each(function(){
            var $container = $(this);
            var $textarea = $('textarea', $container);

            var $help_area = $('div.markdown_help', $container);
            var $help_contents = $('div.markdown_help_contents', $container);

            // Add "info" tool & override action "preview" tool
            var toolbar = [];
            for (var i in SimpleMDE.toolbar) {
              var tool = SimpleMDE.toolbar[i];
              if (tool !== null && typeof tool === 'object' && tool.name === 'preview') {
                  toolbar.push({
                    name: 'info',
                    action: show_help,
                    className: 'fa fa-info'
                  });
                  toolbar.push({
                    name: 'preview',
                    action: show_preview,
                    className: 'fa fa-eye'
                  });
              } else {
                toolbar.push(tool);
              }
            }

            var editor = new SimpleMDE({
              element: $textarea[0],
              autofocus: false,
              toolbar: toolbar
            });
            editor.render();

            function show_help(editor) {
              $help_contents.html('Loading...');
              $.get($help_contents.attr('data-url'), function (data) {
                $help_contents.html(data);
                var display_section = function(evt) {
                  var $all_sections = $('.markdown_syntax_section', $help_contents);
                  var $this_section = $(location.hash.replace('#', '.'), $help_contents);
                  if ($this_section.length === 0) {
                    $this_section = $('.md_ex_toc', $help_contents);
                  }
                  $all_sections.addClass('hidden_in_modal');
                  $this_section.removeClass('hidden_in_modal');
                  $('.markdown_syntax_toc_crumb').toggle(!$this_section.is('.md_ex_toc'));
                };
                $('.markdown_syntax_toc a', $help_contents).click(display_section);
                $(window).bind('hashchange', display_section); // handle back button
              });
              $help_area.lightbox_me();
            }

            function show_preview(editor) {
              /*
               * This is pretty much the same as original SimpleMDE.togglePreview,
               * but rendered text is fetched from the server (see the comment bellow)
               * https://github.com/NextStepWebs/simplemde-markdown-editor/blob/1.2.1/source%20files/markdownify.js#L218-L249
               */
              var toolbar_div = document.getElementsByClassName('editor-toolbar')[0];
              var toolbar = editor.toolbar.preview;
              var parse = editor.constructor.markdown;
              var cm = editor.codemirror;
              var wrapper = cm.getWrapperElement();
              var preview = wrapper.lastChild;
              if (!/editor-preview/.test(preview.className)) {
                preview = document.createElement('div');
                preview.className = 'editor-preview';
                wrapper.appendChild(preview);
              }
              if (/editor-preview-active/.test(preview.className)) {
                preview.className = preview.className.replace(
                  /\s*editor-preview-active\s*/g, ''
                );
                toolbar.className = toolbar.className.replace(/\s*active\s*/g, '');
                toolbar_div.className = toolbar_div.className.replace(/\s*disabled-for-preview\s*/g, '');
              } else {
                /* When the preview button is clicked for the first time,
                 * give some time for the transition from editor.css to fire and the view to slide from right to left,
                 * instead of just appearing.
                 */
                setTimeout(function() {
                  preview.className += ' editor-preview-active';
                }, 1);
                toolbar.className += ' active';
                toolbar_div.className += ' disabled-for-preview';

                /* Code modified by Allura is here */
                var text = cm.getValue();
                get_rendered_text(preview, text);
              }
              $container.toggleClass('preview-active');
              $container.siblings('span.arw').toggleClass('preview-active');
            }

            function get_rendered_text(preview, text) {
              preview.innerHTML = 'Loading...';
              var cval = $.cookie('_session_id');
              $.post('/nf/markdown_to_html', {
                markdown: text,
                project: $('input.markdown_project', $container).val(),
                neighborhood: $('input.markdown_neighborhood', $container).val(),
                app: $('input.markdown_app', $container).val(),
                _session_id: cval
              },
              function(resp) {
                preview.innerHTML = resp;
              });
            }

            $('.close', $help_area).bind('click', function() {
              $help_area.hide();
            });
        });
    }
});
