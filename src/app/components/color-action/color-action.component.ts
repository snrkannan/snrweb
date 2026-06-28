import { Component } from '@angular/core';

@Component({
  selector: 'app-color-action',
  templateUrl: './color-action.component.html',
  styleUrls: ['./color-action.component.scss']
})
export class ColorActionComponent {
  tools = [
    { icon: 'picture_as_pdf', name: 'PDF Splitter',      desc: 'Split PDF files into smaller parts',              route: '/pdf-splitter'     },
    { icon: 'layers',         name: 'PDF Merger',         desc: 'Merge multiple PDFs into one',                    route: '/pdf-merger'       },
    { icon: 'edit',           name: 'Cursive Generator',  desc: 'Generate cursive writing practice sheets',        route: '/cursive-write'    },
    { icon: 'calendar_today', name: 'Date Converter',     desc: 'Convert dates, timezones and milliseconds',       route: '/date-Converter'   },
    { icon: 'grid_3x3',       name: 'Crossword Puzzle',   desc: 'Create and solve crossword puzzles',              route: '/crossword-puzzle' },
    { icon: 'grid_on',         name: 'Sudoku',             desc: 'Play and solve Sudoku puzzles',                   route: '/sudoku'           },
    { icon: 'account_tree',    name: 'Family Tree',        desc: 'Build and explore your family genealogy',         route: '/family-tree'      },
  ];
}
